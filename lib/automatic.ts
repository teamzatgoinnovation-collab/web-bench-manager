import type { EnvKey } from "./config";
import { assertPackageName, assertSiteName } from "./config";
import {
  buildApp,
  clearCache,
  clearWebsiteCache,
  listApps,
  migrate,
  redactSecrets,
  refreshSite,
} from "./bench";
import { appendLog, createJob, finishStage, setJobStatus, startStage } from "./jobs";

export type AutomaticAction =
  | "list-apps"
  | "migrate"
  | "clear-cache"
  | "clear-website-cache"
  | "build";

const LONG: Set<AutomaticAction> = new Set(["migrate", "build"]);

export function isAutomaticAction(v: string): v is AutomaticAction {
  return (
    v === "list-apps" ||
    v === "migrate" ||
    v === "clear-cache" ||
    v === "clear-website-cache" ||
    v === "build"
  );
}

export async function runAutomaticSync(opts: {
  action: AutomaticAction;
  env: EnvKey;
  site: string;
  package?: string;
}) {
  const site = assertSiteName(opts.site);
  const env = opts.env;

  switch (opts.action) {
    case "list-apps": {
      const apps = await listApps(env, site);
      return { ok: apps.result.ok, result: apps.result, apps: apps.apps };
    }
    case "clear-cache": {
      const result = await clearCache(env, site);
      const apps = await listApps(env, site);
      return { ok: result.ok, result, apps: apps.apps };
    }
    case "clear-website-cache": {
      const result = await clearWebsiteCache(env, site);
      const refresh = await refreshSite(env, site);
      return { ok: result.ok, result, apps: refresh.apps.apps };
    }
    case "migrate": {
      const result = await migrate(env, site);
      const refresh = await refreshSite(env, site);
      return { ok: result.ok, result, apps: refresh.apps.apps };
    }
    case "build": {
      const pkg = assertPackageName(opts.package || "");
      const result = await buildApp(env, site, pkg);
      const refresh = await refreshSite(env, site);
      return { ok: result.ok, result, apps: refresh.apps.apps };
    }
    default:
      return { ok: false, result: { ok: false, code: 1, stdout: "", stderr: "Unknown action", command: "" } };
  }
}

export function startAutomaticJob(opts: {
  action: AutomaticAction;
  env: EnvKey;
  site: string;
  package?: string;
}): string {
  const job = createJob(`automatic:${opts.action}`, { env: opts.env, site: opts.site });
  const jobId = job.id;

  void (async () => {
    setJobStatus(jobId, "running");
    const log = (line: string) => appendLog(jobId, redactSecrets(line));
    try {
      log(`Automatic ${opts.action} · env=${opts.env} · site=${opts.site}`);
      startStage(jobId, "run", opts.action);
      const out = await runAutomaticSync(opts);
      log(out.result.stdout || "");
      if (out.result.stderr) log(out.result.stderr);
      if (!out.ok) {
        finishStage(jobId, "run", "failed");
        throw new Error(out.result.stderr || `${opts.action} failed`);
      }
      finishStage(jobId, "run", "succeeded");
      if (opts.action !== "list-apps") {
        startStage(jobId, "refresh", "refresh");
        log(`apps: ${(out.apps || []).join(", ")}`);
        finishStage(jobId, "refresh", "succeeded");
      }
      setJobStatus(jobId, "succeeded", { result: out });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`ERROR: ${message}`);
      setJobStatus(jobId, "failed", { error: message });
    }
  })();

  return jobId;
}

export function shouldUseJob(action: AutomaticAction): boolean {
  return LONG.has(action);
}
