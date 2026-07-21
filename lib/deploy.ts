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
import { appendLog, createJob, finishStage, setJobStatus, startStage } from "./jobs";

export async function startDeployJob(opts: {
  env: EnvKey;
  site: string;
  apps: string[];
}): Promise<string> {
  const site = assertSiteName(opts.site);
  const job = createJob("deploy", { env: opts.env, site });
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

        const prefix = app.package;
        log(`\n=== ${app.label} (${app.package}) ===`);

        const pushId = `${prefix}:push`;
        startStage(jobId, pushId, `${app.label}: push`);
        const push = await gitPushIfNeeded(app, log);
        if (!push.ok) {
          finishStage(jobId, pushId, "failed");
          throw new Error(push.stderr || push.stdout || `git push failed for ${app.package}`);
        }
        finishStage(jobId, pushId, "succeeded");

        const syncId = `${prefix}:sync`;
        const exists = await appExistsOnBench(opts.env, app.package);
        if (exists) {
          startStage(jobId, syncId, `${app.label}: git pull`);
          log(`[bench] git pull apps/${app.package}`);
          const pull = await gitPullApp(opts.env, app.package);
          log(pull.stdout || pull.stderr);
          if (!pull.ok) {
            finishStage(jobId, syncId, "failed");
            throw new Error(`git pull failed for ${app.package}: ${pull.stderr}`);
          }
          finishStage(jobId, syncId, "succeeded");
        } else {
          startStage(jobId, syncId, `${app.label}: get-app`);
          log(`[bench] get-app ${app.remote}`);
          const got = await getApp(opts.env, app.remote);
          log(got.stdout || got.stderr);
          if (!got.ok) {
            finishStage(jobId, syncId, "failed");
            throw new Error(`get-app failed for ${app.package}: ${got.stderr}`);
          }
          finishStage(jobId, syncId, "succeeded");
        }

        const installId = `${prefix}:install`;
        const installed = await listApps(opts.env, site);
        if (!installed.apps.includes(app.package)) {
          startStage(jobId, installId, `${app.label}: install-app`);
          log(`[bench] install-app ${app.package}`);
          const inst = await installApp(opts.env, site, app.package);
          log(inst.stdout || inst.stderr);
          if (!inst.ok) {
            finishStage(jobId, installId, "failed");
            throw new Error(`install-app failed: ${inst.stderr}`);
          }
          finishStage(jobId, installId, "succeeded");
        } else {
          startStage(jobId, installId, `${app.label}: install-app`);
          log(`[bench] ${app.package} already installed on ${site}`);
          finishStage(jobId, installId, "skipped");
        }

        const migrateId = `${prefix}:migrate`;
        startStage(jobId, migrateId, `${app.label}: migrate`);
        log(`[bench] migrate`);
        const mig = await migrate(opts.env, site);
        log(mig.stdout || mig.stderr);
        if (!mig.ok) {
          finishStage(jobId, migrateId, "failed");
          throw new Error(`migrate failed: ${mig.stderr}`);
        }
        finishStage(jobId, migrateId, "succeeded");

        const cacheId = `${prefix}:clear-cache`;
        startStage(jobId, cacheId, `${app.label}: clear-cache`);
        log(`[bench] clear-cache`);
        const clr = await clearCache(opts.env, site);
        log(clr.stdout || clr.stderr);
        if (!clr.ok) {
          finishStage(jobId, cacheId, "failed");
          throw new Error(`clear-cache failed: ${clr.stderr}`);
        }
        finishStage(jobId, cacheId, "succeeded");

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
