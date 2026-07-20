import type { EnvKey } from "./config";
import { assertSiteName } from "./config";
import { getCatalogApp } from "./catalog";
import {
  appExistsOnBench,
  clearCache,
  getApp,
  gitPullApp,
  installApp,
  listApps,
  migrate,
} from "./bench";
import { gitPushIfNeeded } from "./git";
import { appendLog, createJob, setJobStatus } from "./jobs";

export async function startDeployJob(opts: {
  env: EnvKey;
  site: string;
  apps: string[];
}): Promise<string> {
  const site = assertSiteName(opts.site);
  const job = createJob("deploy");
  const jobId = job.id;

  void (async () => {
    setJobStatus(jobId, "running");
    const log = (line: string) => appendLog(jobId, line);

    try {
      log(`Deploy start · env=${opts.env} · site=${site} · apps=${opts.apps.join(", ")}`);

      for (const id of opts.apps) {
        const app = getCatalogApp(id);
        if (!app) {
          throw new Error(`Unknown catalog app: ${id}`);
        }

        log(`\n=== ${app.label} (${app.package}) ===`);

        const push = await gitPushIfNeeded(app, log);
        if (!push.ok) {
          throw new Error(push.stderr || push.stdout || `git push failed for ${app.package}`);
        }

        const exists = await appExistsOnBench(opts.env, app.package);
        if (exists) {
          log(`[bench] git pull apps/${app.package}`);
          const pull = await gitPullApp(opts.env, app.package);
          log(pull.stdout || pull.stderr);
          if (!pull.ok) throw new Error(`git pull failed for ${app.package}: ${pull.stderr}`);
        } else {
          log(`[bench] get-app ${app.remote}`);
          const got = await getApp(opts.env, app.remote);
          log(got.stdout || got.stderr);
          if (!got.ok) throw new Error(`get-app failed for ${app.package}: ${got.stderr}`);
        }

        const installed = await listApps(opts.env, site);
        if (!installed.apps.includes(app.package)) {
          log(`[bench] install-app ${app.package}`);
          const inst = await installApp(opts.env, site, app.package);
          log(inst.stdout || inst.stderr);
          if (!inst.ok) throw new Error(`install-app failed: ${inst.stderr}`);
        } else {
          log(`[bench] ${app.package} already installed on ${site}`);
        }

        log(`[bench] migrate`);
        const mig = await migrate(opts.env, site);
        log(mig.stdout || mig.stderr);
        if (!mig.ok) throw new Error(`migrate failed: ${mig.stderr}`);

        log(`[bench] clear-cache`);
        const clr = await clearCache(opts.env, site);
        log(clr.stdout || clr.stderr);
        if (!clr.ok) throw new Error(`clear-cache failed: ${clr.stderr}`);

        const apps = await listApps(opts.env, site);
        log(`[bench] list-apps: ${apps.apps.join(", ")}`);
      }

      log("\nDeploy finished successfully.");
      setJobStatus(jobId, "succeeded", { result: { site, env: opts.env, apps: opts.apps } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`\nERROR: ${message}`);
      setJobStatus(jobId, "failed", { error: message });
    }
  })();

  return jobId;
}
