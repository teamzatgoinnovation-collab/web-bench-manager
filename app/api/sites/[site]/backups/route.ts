import { NextResponse } from "next/server";
import { getPrefs, isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { isEnvKey, isValidSiteName } from "@/lib/config";
import { listBackups } from "@/lib/bench";

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

  const { backups, result } = await listBackups(env, site);
  return NextResponse.json({
    env,
    site,
    backups,
    docker: {
      ok: result.ok,
      stderr: result.stderr,
      command: result.command,
    },
  });
}
