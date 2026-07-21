import { NextResponse } from "next/server";
import { getPrefs, isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { isEnvKey, isValidPackageName, isValidSiteName } from "@/lib/config";
import {
  isAutomaticAction,
  shouldUseJob,
  startAutomaticJob,
  runAutomaticSync,
} from "@/lib/automatic";

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

  if (!action || !isAutomaticAction(action)) {
    return NextResponse.json({ error: "Invalid automatic action" }, { status: 400 });
  }
  if (action === "build" && (!body.package || !isValidPackageName(body.package))) {
    return NextResponse.json({ error: "package required for build" }, { status: 400 });
  }

  try {
    if (shouldUseJob(action)) {
      const jobId = startAutomaticJob({
        action,
        env,
        site,
        package: body.package,
      });
      return NextResponse.json({ ok: true, async: true, jobId });
    }

    const out = await runAutomaticSync({
      action,
      env,
      site,
      package: body.package,
    });
    return NextResponse.json({ async: false, ...out });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
