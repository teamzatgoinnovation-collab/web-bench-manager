import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommand, type RunResult } from "./exec";
import { getWorkspaceRoot, assertPackageName, assertSiteName, isValidSiteName } from "./config";
import { appendLog, createJob, finishStage, setJobStatus, startStage } from "./jobs";

/**
 * Hetzner fleet ops: one compose project (`erpnext`), several bench containers sharing one
 * `sites/` volume but each with its OWN `apps/` filesystem (apps/ is not a volume), and a server
 * that cannot reach GitHub. So custom-app code is shipped as `git archive` → scp → `docker cp`
 * into every bench container, never `git pull` on the box.
 */

export type FleetTarget = { host: string; user: string; port: number; keyPath?: string; project: string };

const BENCH_ROLE_RE = /^([A-Za-z0-9_-]+)-(backend|queue-short|queue-long|scheduler|websocket|frontend)-\d+$/;
const BENCH_DIR = "/home/frappe/frappe-bench";

/** package → repo directory (relative to workspace root). Only apps that really ship to the box. */
export const FLEET_APPS: Record<string, { repo: string; label: string }> = {
  zatgo_core: { repo: "erpnext/zatgo-core", label: "ZatGo Core" },
  space: { repo: "erpnext/space", label: "Space" },
  space_cloud: { repo: "erpnext/space_cloud", label: "Space Cloud" },
  zatca_erpgulf: { repo: "erpnext/zatca_erpgulf", label: "ZATCA (erpgulf)" },
  print_designer: { repo: "erpnext/print_designer", label: "Print Designer" },
};

export function getFleetTarget(): FleetTarget {
  return {
    host: process.env.HETZNER_SSH_HOST?.trim() || "2.29.17.8",
    user: process.env.HETZNER_SSH_USER?.trim() || "root",
    port: Number(process.env.HETZNER_SSH_PORT || 22),
    keyPath: process.env.HETZNER_SSH_KEY_PATH?.trim() || undefined,
    project: process.env.HETZNER_COMPOSE_PROJECT?.trim() || "erpnext",
  };
}

function sshArgs(t: FleetTarget): string[] {
  const a = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=15", "-p", String(t.port)];
  if (t.keyPath) a.push("-i", t.keyPath);
  return a;
}

function scpArgs(t: FleetTarget): string[] {
  const a = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=15", "-P", String(t.port)];
  if (t.keyPath) a.push("-i", t.keyPath);
  return a;
}

function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** FLEET_TRANSPORT=local: the tool runs on the box itself (docker.sock mounted) — no ssh hop. */
export function isLocalFleetTransport(): boolean {
  return process.env.FLEET_TRANSPORT === "local";
}

export function fleetSsh(remote: string, timeoutMs = 120_000, t = getFleetTarget()): Promise<RunResult> {
  if (isLocalFleetTransport()) return runCommand("sh", ["-c", remote], { timeoutMs });
  return runCommand("ssh", [...sshArgs(t), `${t.user}@${t.host}`, "--", remote], { timeoutMs });
}

export type FleetContainer = { name: string; role: string; running: boolean };

export async function listBenchContainers(t = getFleetTarget()): Promise<FleetContainer[]> {
  const r = await fleetSsh(`docker ps -a --format '{{.Names}}|{{.State}}'`, 30_000, t);
  if (!r.ok) throw new Error(r.stderr || "ssh docker ps failed");
  const out: FleetContainer[] = [];
  for (const line of r.stdout.split("\n")) {
    const [name, state] = line.trim().split("|");
    const m = name ? BENCH_ROLE_RE.exec(name) : null;
    if (m && m[1] === t.project) out.push({ name, role: m[2], running: state === "running" });
  }
  return out;
}


export async function localHead(pkg: string) {
  const entry = FLEET_APPS[pkg];
  const dir = path.join(getWorkspaceRoot(), entry.repo);
  if (!fs.existsSync(path.join(dir, ".git"))) {
    return { head: null as string | null, dirty: false, error: `no git repo at ${dir}` };
  }
  const head = (await runCommand("git", ["rev-parse", "--short", "HEAD"], { cwd: dir })).stdout.trim() || null;
  const dirty = (await runCommand("git", ["status", "--porcelain"], { cwd: dir })).stdout.trim() !== "";
  return { head, dirty };
}

const MARKER = ".zatgo-synced-commit";

export type SiteRow = { site: string; apps: string[]; error?: string };
export type FleetSnapshot = {
  target: { host: string; project: string };
  containers: FleetContainer[];
  sites: SiteRow[];
  bootApps: string[];
  /** deployed[app][container] = commit short sha recorded at last sync, "unknown", or "missing" */
  deployed: Record<string, Record<string, string>>;
  local: Record<string, { head: string | null; dirty: boolean; error?: string }>;
  checkedAt: number;
  /** false on the hosted copy: the source repos live on the operator's machine, not on the box */
  canDeploy: boolean;
};

export async function fleetSnapshot(): Promise<FleetSnapshot> {
  const t = getFleetTarget();
  const containers = await listBenchContainers(t);
  const backend = containers.find((c) => c.role === "backend" && c.running);
  if (!backend) throw new Error(`No running ${t.project}-backend container on ${t.host}`);

  const bootRes = await fleetSsh(`docker exec ${backend.name} cat sites/apps.txt`, 30_000, t);
  const bootApps = bootRes.stdout.split("\n").map((l) => l.trim()).filter(Boolean);

  const sitesRes = await fleetSsh(
    `docker exec ${backend.name} bash -lc 'cd sites && for d in */; do d=\${d%/}; [ -f "$d/site_config.json" ] && echo "$d"; done'`,
    30_000,
    t,
  );
  const siteNames = sitesRes.stdout.split("\n").map((s) => s.trim()).filter(isValidSiteName);

  const sites: SiteRow[] = [];
  for (const site of siteNames) {
    const r = await fleetSsh(`docker exec ${backend.name} bench --site ${shq(site)} list-apps`, 60_000, t);
    if (!r.ok) {
      sites.push({ site, apps: [], error: (r.stderr || r.stdout).split("\n").slice(-2).join(" ").trim() });
      continue;
    }
    const apps = r.stdout
      .split("\n")
      .map((l) => l.trim().split(/\s+/)[0])
      .filter((x) => x && /^[a-z][a-z0-9_]*$/i.test(x) && x.toLowerCase() !== "app");
    sites.push({ site, apps: [...new Set(apps)] });
  }

  const deployed: FleetSnapshot["deployed"] = {};
  const local: FleetSnapshot["local"] = {};
  const pkgs = Object.keys(FLEET_APPS);
  for (const pkg of pkgs) {
    local[pkg] = await localHead(pkg);
    deployed[pkg] = {};
  }
  const script = pkgs
    .map((p) => `for c in ${containers.map((c) => c.name).join(" ")}; do echo "$c|${p}|$(docker exec $c sh -c 'test -d apps/${p} && (cat apps/${p}/${MARKER} 2>/dev/null || echo unknown) || echo missing' 2>/dev/null || echo down)"; done`)
    .join("; ");
  const mark = await fleetSsh(script, 90_000, t);
  for (const line of mark.stdout.split("\n")) {
    const [c, p, v] = line.trim().split("|");
    if (c && p && deployed[p]) deployed[p][c] = (v || "").trim() || "unknown";
  }

  return {
    target: { host: t.host, project: t.project },
    containers,
    sites,
    bootApps,
    deployed,
    local,
    checkedAt: Date.now(),
    canDeploy: !isLocalFleetTransport(),
  };
}

export type SyncOptions = {
  apps: string[];
  /** sites to migrate + clear-cache; empty = skip migrate */
  sites: string[];
  restart: boolean;
  build: boolean;
  allowDirty: boolean;
};

export function startFleetSyncJob(opts: SyncOptions): string {
  if (isLocalFleetTransport()) {
    throw new Error("Code deploy is disabled on the hosted copy (no source checkout / GitHub access on the box). Run Bench Manager locally to deploy.");
  }
  const t = getFleetTarget();
  const job = createJob("hetzner-sync", { env: "cloud" });
  const id = job.id;
  const log = (l: string) => appendLog(id, l);

  void (async () => {
    setJobStatus(id, "running");
    const stage = async <T extends RunResult>(sid: string, label: string, fn: () => Promise<T>, soft = false) => {
      startStage(id, sid, label);
      const r = await fn();
      log(`$ ${r.command.replace(/\s+/g, " ").slice(0, 300)}`);
      if (r.stdout.trim()) log(r.stdout.trim().split("\n").slice(-25).join("\n"));
      if (r.stderr.trim()) log(r.stderr.trim().split("\n").slice(-15).join("\n"));
      finishStage(id, sid, r.ok ? "succeeded" : soft ? "skipped" : "failed");
      if (!r.ok && !soft) throw new Error(`${label} failed`);
      return r;
    };

    try {
      const sites = opts.sites.map(assertSiteName);
      const containers = (await listBenchContainers(t)).filter((c) => c.running);
      const backend = containers.find((c) => c.role === "backend");
      if (!backend) throw new Error("no running backend container");
      log(`Target ${t.user}@${t.host} · containers: ${containers.map((c) => c.name).join(", ")}`);

      for (const pkg of opts.apps) {
        assertPackageName(pkg);
        const entry = FLEET_APPS[pkg];
        if (!entry) throw new Error(`Unknown fleet app: ${pkg}`);
        const dir = path.join(getWorkspaceRoot(), entry.repo);
        const st = await localHead(pkg);
        if (!st.head) throw new Error(st.error || `cannot read git HEAD for ${pkg}`);
        if (st.dirty && !opts.allowDirty) {
          throw new Error(`${pkg} has uncommitted changes — commit first (only committed HEAD ships) or tick "allow dirty"`);
        }
        log(`\n=== ${entry.label} @ ${st.head}${st.dirty ? " (dirty tree ignored, HEAD only)" : ""} ===`);

        const remoteTmp = `/tmp/fleet-sync-${pkg}-${st.head}`;
        const tarLocal = path.join(os.tmpdir(), `fleet-${pkg}-${st.head}.tar`);
        await stage(`${pkg}:archive`, `${pkg}: git archive`, () =>
          runCommand("git", ["archive", "--format=tar", "-o", tarLocal, "HEAD"], { cwd: dir }),
        );
        await stage(`${pkg}:upload`, `${pkg}: upload`, () =>
          runCommand("scp", [...scpArgs(t), tarLocal, `${t.user}@${t.host}:${remoteTmp}.tar`], {
            timeoutMs: 10 * 60_000,
          }),
        );
        fs.rmSync(tarLocal, { force: true });
        await stage(`${pkg}:unpack`, `${pkg}: unpack on host`, () =>
          fleetSsh(`rm -rf ${remoteTmp} && mkdir -p ${remoteTmp} && tar -xf ${remoteTmp}.tar -C ${remoteTmp} && echo ${st.head} > ${remoteTmp}/${MARKER}`, 120_000, t),
        );

        for (const c of containers) {
          await stage(`${pkg}:cp:${c.name}`, `${pkg}: copy → ${c.name}`, () =>
            fleetSsh(
              `docker exec -u root ${c.name} mkdir -p ${BENCH_DIR}/apps/${pkg} && docker cp ${remoteTmp}/. ${c.name}:${BENCH_DIR}/apps/${pkg}/ && docker exec -u root ${c.name} chown -R frappe:frappe ${BENCH_DIR}/apps/${pkg}`,
              300_000,
              t,
            ),
          );
        }

        // Every container needs the package importable (bench CLI scans all apps in apps.txt).
        for (const c of containers) {
          await stage(
            `${pkg}:pip:${c.name}`,
            `${pkg}: pip install -e → ${c.name}`,
            () => fleetSsh(`docker exec ${c.name} bash -lc 'cd ${BENCH_DIR} && (pip show ${pkg} >/dev/null 2>&1 || ./env/bin/pip install -q --no-deps -e apps/${pkg})'`, 600_000, t),
            true,
          );
        }

        await stage(`${pkg}:bootlist`, `${pkg}: ensure in apps.txt`, () =>
          fleetSsh(`docker exec ${backend.name} bash -lc 'cd ${BENCH_DIR}/sites && grep -qx ${pkg} apps.txt || echo ${pkg} >> apps.txt'`, 30_000, t),
        );
        await fleetSsh(`rm -rf ${remoteTmp} ${remoteTmp}.tar`, 30_000, t);
      }

      for (const site of sites) {
        await stage(`migrate:${site}`, `migrate ${site}`, () =>
          fleetSsh(`docker exec ${backend.name} bench --site ${shq(site)} migrate`, 30 * 60_000, t),
        );
        if (opts.build) {
          for (const pkg of opts.apps) {
            await stage(`build:${site}:${pkg}`, `build ${pkg}`, () =>
              fleetSsh(`docker exec ${backend.name} bench build --app ${pkg}`, 30 * 60_000, t), true);
          }
        }
        await stage(`cache:${site}`, `clear-cache ${site}`, () =>
          fleetSsh(`docker exec ${backend.name} bench --site ${shq(site)} clear-cache`, 120_000, t),
        );
      }

      if (opts.restart) {
        const names = containers.filter((c) => c.role !== "frontend").map((c) => c.name).join(" ");
        await stage("restart", "restart backend/queue/scheduler/websocket", () =>
          fleetSsh(`docker restart ${names}`, 300_000, t),
        );
      }

      log("\nFleet sync finished.");
      setJobStatus(id, "succeeded", { result: { apps: opts.apps, sites } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`\nERROR: ${msg}`);
      setJobStatus(id, "failed", { error: msg });
    }
  })();

  return id;
}
