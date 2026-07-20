import { NextResponse } from "next/server";
import { getPrefs, isAuthenticated, PREFS_COOKIE, encodePrefs, requireAuthResponse } from "@/lib/auth";
import { isEnvKey, isValidSiteName } from "@/lib/config";
import { listSites, pickDefaultSite } from "@/lib/bench";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  const url = new URL(request.url);
  const prefs = await getPrefs();
  const envParam = url.searchParams.get("env");
  const env = envParam && isEnvKey(envParam) ? envParam : prefs.env;

  const { sites, result } = await listSites(env);
  return NextResponse.json({
    env,
    sites,
    defaultSite: pickDefaultSite(sites),
    selectedSite: prefs.site,
    docker: {
      ok: result.ok,
      stderr: result.stderr,
      command: result.command,
    },
  });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  let body: { env?: string; site?: string } = {};
  try {
    body = (await request.json()) as { env?: string; site?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prefs = await getPrefs();
  const env = body.env && isEnvKey(body.env) ? body.env : prefs.env;
  const site = body.site && isValidSiteName(body.site) ? body.site : prefs.site;

  const next = { env, site };
  const res = NextResponse.json({ ok: true, prefs: next });
  res.cookies.set(PREFS_COOKIE, encodePrefs(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
