import { NextResponse } from "next/server";
import { getPrefs, isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { isEnvKey, isValidSiteName } from "@/lib/config";
import { envHealth, listApps, listBackups, listSites } from "@/lib/bench";
import { listRecentJobs } from "@/lib/jobs";
import { readStoredSettings, DEFAULT_DO_DESK_URL } from "@/lib/settings-store";

export async function GET(
  request: Request,
  context: { params: Promise<{ site: string }> },
) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  const { site: rawSite } = await context.params;
  const site = decodeURIComponent(rawSite);
  if (!isValidSiteName(site)) {
    return NextResponse.json({ error: "Invalid site name" }, { status: 400 });
  }

  const url = new URL(request.url);
  const prefs = await getPrefs();
  const envParam = url.searchParams.get("env");
  const env = envParam && isEnvKey(envParam) ? envParam : prefs.env;

  const [sitesOut, appsOut, backupsOut, health] = await Promise.all([
    listSites(env),
    listApps(env, site),
    listBackups(env, site),
    envHealth(env),
  ]);

  const settings = readStoredSettings();
  const deskUrl =
    env === "cloud"
      ? settings.doDeskUrl?.trim() || process.env.DO_DESK_URL?.trim() || DEFAULT_DO_DESK_URL
      : `http://${site}`;

  const recentJobs = listRecentJobs(20).filter(
    (j) => j.meta?.site === site || (!j.meta?.site && prefs.site === site),
  );

  return NextResponse.json({
    env,
    site,
    exists: sitesOut.sites.includes(site),
    apps: appsOut.apps,
    appCount: appsOut.apps.length,
    lastBackup: backupsOut.backups[0] || null,
    backupCount: backupsOut.backups.length,
    deskUrl,
    health: {
      running: health.running,
      container: health.container,
      transport: health.transport,
      sshHostRedacted: health.sshHostRedacted,
      sshError: health.sshError,
    },
    recentJobs: recentJobs.slice(0, 5).map((j) => ({
      id: j.id,
      kind: j.kind,
      status: j.status,
      createdAt: j.createdAt,
    })),
    docker: {
      ok: appsOut.result.ok || sitesOut.result.ok,
      stderr: appsOut.result.stderr || sitesOut.result.stderr,
    },
  });
}
