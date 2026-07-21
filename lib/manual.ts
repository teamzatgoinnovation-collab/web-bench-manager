import type { EnvKey } from "./config";
import { assertPackageName, assertSiteName } from "./config";
import { getCatalogApp } from "./catalog";
import {
  appExistsOnBench,
  backupSite,
  dropSite,
  getApp,
  installApp,
  listApps,
  newSite,
  purgeDesktopIcons,
  redactSecrets,
  refreshSite,
  restoreSite,
  setAdminPassword,
  uninstallApp,
} from "./bench";
import { appendLog, createJob, setJobStatus } from "./jobs";

export type ManualAction =
  | "new-site"
  | "install-app"
  | "uninstall-app"
  | "set-admin-password"
  | "backup"
  | "restore"
  | "drop-site";

export function isManualAction(v: string): v is ManualAction {
  return (
    v === "new-site" ||
    v === "install-app" ||
    v === "uninstall-app" ||
    v === "set-admin-password" ||
    v === "backup" ||
    v === "restore" ||
    v === "drop-site"
  );
}

export type ManualPayload = {
  action: ManualAction;
  env: EnvKey;
  site: string;
  package?: string;
  adminPassword?: string;
  installErpnext?: boolean;
  setDefault?: boolean;
  withFiles?: boolean;
  restorePath?: string;
  confirmSite?: string;
  confirmed?: boolean;
};

export function startManualJob(payload: ManualPayload): string {
  const job = createJob(`manual:${payload.action}`);
  const jobId = job.id;

  void (async () => {
    setJobStatus(jobId, "running");
    const log = (line: string) => appendLog(jobId, redactSecrets(line));
    try {
      log(`Manual ${payload.action} · env=${payload.env} · site=${payload.site}`);
      const out = await runManual(payload, log);
      if (!out.ok) throw new Error(out.error || `${payload.action} failed`);
      log("Done.");
      setJobStatus(jobId, "succeeded", { result: out });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`ERROR: ${message}`);
      setJobStatus(jobId, "failed", { error: message });
    }
  })();

  return jobId;
}

async function runManual(
  payload: ManualPayload,
  log: (line: string) => void,
): Promise<{ ok: boolean; error?: string; apps?: string[]; sitesHint?: string }> {
  const env = payload.env;
  const site = payload.site ? assertSiteName(payload.site) : "";

  switch (payload.action) {
    case "new-site": {
      const result = await newSite(env, {
        site,
        adminPassword: payload.adminPassword || "",
        installErpnext: Boolean(payload.installErpnext),
        setDefault: Boolean(payload.setDefault),
      });
      log(result.stdout || result.stderr);
      return { ok: result.ok, error: result.ok ? undefined : result.stderr };
    }
    case "install-app": {
      const pkg = assertPackageName(payload.package || "");
      const catalog = getCatalogApp(pkg);
      const exists = await appExistsOnBench(env, pkg);
      if (!exists) {
        if (!catalog) {
          return { ok: false, error: "App not on bench and not in catalog" };
        }
        log(`get-app ${catalog.remote}`);
        const got = await getApp(env, catalog.remote);
        log(got.stdout || got.stderr);
        if (!got.ok) return { ok: false, error: got.stderr };
      }
      log(`install-app ${pkg}`);
      const result = await installApp(env, site, pkg);
      log(result.stdout || result.stderr);
      const refresh = await refreshSite(env, site);
      return {
        ok: result.ok,
        error: result.ok ? undefined : result.stderr,
        apps: refresh.apps.apps,
      };
    }
    case "uninstall-app": {
      if (!payload.confirmed) {
        return { ok: false, error: "Confirmation required for uninstall-app" };
      }
      const pkg = assertPackageName(payload.package || "");
      if (pkg === "frappe" || pkg === "erpnext") {
        return { ok: false, error: "Refusing to uninstall frappe/erpnext" };
      }
      log(`uninstall-app ${pkg}`);
      const result = await uninstallApp(env, site, pkg);
      log(result.stdout || result.stderr);
      const purge = await purgeDesktopIcons(env, site, pkg);
      log(purge.stdout || purge.stderr);
      const refresh = await refreshSite(env, site);
      return {
        ok: result.ok,
        error: result.ok ? undefined : result.stderr,
        apps: refresh.apps.apps,
      };
    }
    case "set-admin-password": {
      const result = await setAdminPassword(env, site, payload.adminPassword || "");
      log(result.ok ? "Admin password updated" : result.stderr);
      return { ok: result.ok, error: result.ok ? undefined : result.stderr };
    }
    case "backup": {
      const result = await backupSite(env, site, Boolean(payload.withFiles));
      log(result.stdout || result.stderr);
      return { ok: result.ok, error: result.ok ? undefined : result.stderr };
    }
    case "restore": {
      if (!payload.confirmed) {
        return { ok: false, error: "Confirmation required for restore" };
      }
      const result = await restoreSite(env, site, payload.restorePath || "");
      log(result.stdout || result.stderr);
      const refresh = await refreshSite(env, site);
      return {
        ok: result.ok,
        error: result.ok ? undefined : result.stderr,
        apps: refresh.apps.apps,
      };
    }
    case "drop-site": {
      if (payload.confirmSite !== site) {
        return { ok: false, error: "Type the exact site name to confirm drop-site" };
      }
      const result = await dropSite(env, site);
      log(result.stdout || result.stderr);
      return { ok: result.ok, error: result.ok ? undefined : result.stderr };
    }
    default:
      return { ok: false, error: "Unknown action" };
  }
}

export async function peekInstalledApps(env: EnvKey, site: string) {
  return listApps(env, site);
}
