import { NextResponse } from "next/server";
import { getPrefs, isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { isEnvKey, isValidPackageName, isValidSiteName } from "@/lib/config";
import { CATALOG, getCatalogApp } from "@/lib/catalog";
import {
  clearCache,
  getApp,
  gitPullApp,
  installApp,
  listApps,
  migrate,
  purgeDesktopIcons,
  refreshSite,
  uninstallApp,
  appExistsOnBench,
} from "@/lib/bench";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  const url = new URL(request.url);
  const prefs = await getPrefs();
  const env = url.searchParams.get("env");
  const site = url.searchParams.get("site");
  const e = env && isEnvKey(env) ? env : prefs.env;
  const s = site && isValidSiteName(site) ? site : prefs.site;

  const { apps, result } = await listApps(e, s);
  return NextResponse.json({
    env: e,
    site: s,
    apps,
    catalog: CATALOG,
    docker: { ok: result.ok, stderr: result.stderr, command: result.command, stdout: result.stdout },
  });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  let body: {
    action?: string;
    env?: string;
    site?: string;
    package?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prefs = await getPrefs();
  const env = body.env && isEnvKey(body.env) ? body.env : prefs.env;
  const site = body.site && isValidSiteName(body.site) ? body.site : prefs.site;
  const action = body.action;
  const pkg = body.package;

  if (!action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  try {
    switch (action) {
      case "migrate": {
        const result = await migrate(env, site);
        const refresh = await refreshSite(env, site);
        return NextResponse.json({ ok: result.ok, result, refresh });
      }
      case "clear-cache": {
        const result = await clearCache(env, site);
        const apps = await listApps(env, site);
        return NextResponse.json({ ok: result.ok, result, apps: apps.apps });
      }
      case "list-apps": {
        const apps = await listApps(env, site);
        return NextResponse.json({ ok: apps.result.ok, apps: apps.apps, result: apps.result });
      }
      case "pull": {
        if (!pkg || !isValidPackageName(pkg)) {
          return NextResponse.json({ error: "package required" }, { status: 400 });
        }
        const result = await gitPullApp(env, pkg);
        return NextResponse.json({ ok: result.ok, result });
      }
      case "install": {
        if (!pkg || !isValidPackageName(pkg)) {
          return NextResponse.json({ error: "package required" }, { status: 400 });
        }
        const catalog = getCatalogApp(pkg);
        const exists = await appExistsOnBench(env, pkg);
        if (!exists) {
          if (!catalog) {
            return NextResponse.json(
              { error: "App not on bench and not in catalog" },
              { status: 400 },
            );
          }
          const got = await getApp(env, catalog.remote);
          if (!got.ok) return NextResponse.json({ ok: false, result: got }, { status: 500 });
        }
        const result = await installApp(env, site, pkg);
        const refresh = await refreshSite(env, site);
        return NextResponse.json({ ok: result.ok, result, refresh });
      }
      case "uninstall": {
        if (!pkg || !isValidPackageName(pkg)) {
          return NextResponse.json({ error: "package required" }, { status: 400 });
        }
        const result = await uninstallApp(env, site, pkg);
        const purge = await purgeDesktopIcons(env, site, pkg);
        const refresh = await refreshSite(env, site);
        return NextResponse.json({ ok: result.ok, result, purge, refresh });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
