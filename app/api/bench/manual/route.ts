import { NextResponse } from "next/server";
import { getPrefs, isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { isEnvKey, isValidPackageName, isValidSiteName } from "@/lib/config";
import { isManualAction, startManualJob, type ManualPayload } from "@/lib/manual";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  let body: Partial<ManualPayload> = {};
  try {
    body = (await request.json()) as Partial<ManualPayload>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prefs = await getPrefs();
  const env = body.env && isEnvKey(body.env) ? body.env : prefs.env;
  const site = body.site && isValidSiteName(body.site) ? body.site : prefs.site;
  const action = body.action;

  if (!action || !isManualAction(action)) {
    return NextResponse.json({ error: "Invalid manual action" }, { status: 400 });
  }

  if (
    (action === "install-app" || action === "uninstall-app") &&
    (!body.package || !isValidPackageName(body.package))
  ) {
    return NextResponse.json({ error: "package required" }, { status: 400 });
  }

  if (action === "drop-site" && body.confirmSite !== site) {
    return NextResponse.json(
      { error: "Type the exact site name to confirm drop-site" },
      { status: 400 },
    );
  }

  if (
    (action === "uninstall-app" || action === "restore") &&
    !body.confirmed
  ) {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }

  const payload: ManualPayload = {
    action,
    env,
    site,
    package: body.package,
    adminPassword: body.adminPassword,
    installErpnext: body.installErpnext,
    setDefault: body.setDefault,
    withFiles: body.withFiles,
    restorePath: body.restorePath,
    confirmSite: body.confirmSite,
    confirmed: body.confirmed,
  };

  try {
    const jobId = startManualJob(payload);
    return NextResponse.json({ ok: true, async: true, jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
