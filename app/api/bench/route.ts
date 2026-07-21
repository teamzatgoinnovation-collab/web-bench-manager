import { NextResponse } from "next/server";
import { getPrefs, isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { isEnvKey } from "@/lib/config";
import { listBenchAppDirs, listSites } from "@/lib/bench";
import { envTransportHealth } from "@/lib/exec";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  const url = new URL(request.url);
  const prefs = await getPrefs();
  const envParam = url.searchParams.get("env");
  const env = envParam && isEnvKey(envParam) ? envParam : prefs.env;

  const [sitesOut, appsOut, health] = await Promise.all([
    listSites(env),
    listBenchAppDirs(env),
    envTransportHealth(env),
  ]);

  return NextResponse.json({
    env,
    sites: sitesOut.sites,
    siteCount: sitesOut.sites.length,
    appsOnDisk: appsOut.apps,
    health: {
      running: health.running,
      container: health.container,
      transport: health.transport,
      sshHostRedacted: health.sshHostRedacted,
      sshError: health.sshError,
    },
    docker: {
      ok: appsOut.result.ok || sitesOut.result.ok,
      stderr: appsOut.result.stderr || sitesOut.result.stderr,
    },
  });
}
