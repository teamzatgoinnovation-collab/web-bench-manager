import type { EnvKey } from "./config";
import { assertPackageName, assertSiteName, DEFAULT_SITE, isValidSiteName } from "./config";
import {
  backendContainer,
  dockerContainerRunning,
  dockerExec,
  dockerExecBench,
  type RunResult,
} from "./docker";

const SITES_NOISE = new Set([
  "apps",
  "assets",
  "common_site_config.json",
  "apps.txt",
  "apps.json",
  "currentsite.txt",
]);

export async function envHealth(env: EnvKey): Promise<{
  env: EnvKey;
  container: string;
  running: boolean;
}> {
  const container = backendContainer(env);
  const running = await dockerContainerRunning(container);
  return { env, container, running };
}

export async function listSites(env: EnvKey): Promise<{ sites: string[]; result: RunResult }> {
  const result = await dockerExecBench(env, ["ls", "-1", "sites"]);
  if (!result.ok) {
    return { sites: [], result };
  }
  const sites = result.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !SITES_NOISE.has(l) &&
        !l.endsWith(".json") &&
        !l.endsWith(".txt") &&
        isValidSiteName(l),
    );
  return { sites, result };
}

export async function listApps(
  env: EnvKey,
  site: string,
): Promise<{ apps: string[]; result: RunResult }> {
  const s = assertSiteName(site);
  const result = await dockerExecBench(env, ["bench", "--site", s, "list-apps"]);
  if (!result.ok) {
    return { apps: [], result };
  }
  const apps: string[] = [];
  for (const line of result.stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || /^app\b/i.test(trimmed) || trimmed.includes("---")) continue;
    const token = trimmed.split(/\s+/)[0];
    if (token && /^[a-z][a-z0-9_]*$/i.test(token)) {
      apps.push(token);
    }
  }
  return { apps: [...new Set(apps)], result };
}

export async function clearCache(env: EnvKey, site: string): Promise<RunResult> {
  return dockerExecBench(env, ["bench", "--site", assertSiteName(site), "clear-cache"]);
}

export async function migrate(env: EnvKey, site: string): Promise<RunResult> {
  return dockerExecBench(env, ["bench", "--site", assertSiteName(site), "migrate"], {
    timeoutMs: 30 * 60_000,
  });
}

export async function installApp(env: EnvKey, site: string, pkg: string): Promise<RunResult> {
  return dockerExecBench(
    env,
    ["bench", "--site", assertSiteName(site), "install-app", assertPackageName(pkg)],
    { timeoutMs: 30 * 60_000 },
  );
}

export async function uninstallApp(env: EnvKey, site: string, pkg: string): Promise<RunResult> {
  return dockerExecBench(
    env,
    ["bench", "--site", assertSiteName(site), "uninstall-app", assertPackageName(pkg), "--yes"],
    { timeoutMs: 30 * 60_000 },
  );
}

export async function appExistsOnBench(env: EnvKey, pkg: string): Promise<boolean> {
  const p = assertPackageName(pkg);
  const result = await dockerExecBench(env, ["test", "-d", `apps/${p}`]);
  return result.ok;
}

export async function gitPullApp(env: EnvKey, pkg: string): Promise<RunResult> {
  const p = assertPackageName(pkg);
  return dockerExec(backendContainer(env), ["bash", "-lc", `cd apps/${p} && git pull`], {
    timeoutMs: 10 * 60_000,
  });
}

export async function getApp(env: EnvKey, remote: string): Promise<RunResult> {
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/.test(remote)) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: `Remote URL not allowlisted: ${remote}`,
      command: `bench get-app ${remote}`,
    };
  }
  return dockerExecBench(env, ["bench", "get-app", remote], { timeoutMs: 30 * 60_000 });
}

/** Best-effort Desktop Icon leftover purge after uninstall. */
export async function purgeDesktopIcons(
  env: EnvKey,
  site: string,
  pkg: string,
): Promise<RunResult> {
  const s = assertSiteName(site);
  const p = assertPackageName(pkg);
  const list = await dockerExecBench(env, [
    "bench",
    "--site",
    s,
    "execute",
    "frappe.client.get_list",
    "--kwargs",
    JSON.stringify({
      doctype: "Desktop Icon",
      filters: { app: p },
      fields: ["name"],
    }),
  ]);
  if (!list.ok) return list;

  const names = [
    ...list.stdout.matchAll(/'name':\s*'([^']+)'/g),
    ...list.stdout.matchAll(/"name":\s*"([^"]+)"/g),
  ].map((m) => m[1]);
  const unique = [...new Set(names)].filter((n) => /^[A-Za-z0-9 _.-]+$/.test(n));

  for (const name of unique) {
    await dockerExecBench(env, [
      "bench",
      "--site",
      s,
      "execute",
      "frappe.delete_doc",
      "--kwargs",
      JSON.stringify({ doctype: "Desktop Icon", name, force: 1, ignore_permissions: true }),
    ]);
  }

  return {
    ok: true,
    code: 0,
    stdout: `Purged Desktop Icon: ${unique.join(", ") || "(none found)"}`,
    stderr: list.stderr,
    command: list.command,
  };
}

export async function refreshSite(
  env: EnvKey,
  site: string,
): Promise<{
  clear: RunResult;
  apps: { apps: string[]; result: RunResult };
}> {
  const clear = await clearCache(env, site);
  const apps = await listApps(env, site);
  return { clear, apps };
}

export function pickDefaultSite(sites: string[]): string {
  if (sites.includes(DEFAULT_SITE)) return DEFAULT_SITE;
  return sites[0] ?? DEFAULT_SITE;
}
