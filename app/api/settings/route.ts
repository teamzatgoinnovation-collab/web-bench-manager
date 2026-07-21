import { NextResponse } from "next/server";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { clearCloudContainerCache } from "@/lib/exec";
import {
  getSettingsFormValues,
  readStoredSettings,
  writeStoredSettings,
  type StoredSettings,
} from "@/lib/settings-store";
import { getDoSshConfig } from "@/lib/ssh-config";

export async function GET() {
  if (!(await isAuthenticated())) return requireAuthResponse();

  const form = getSettingsFormValues();
  const cfg = getDoSshConfig();
  return NextResponse.json({
    settings: form,
    sshReady: !("error" in cfg),
    sshError: "error" in cfg ? cfg.error : undefined,
    effective:
      "error" in cfg
        ? null
        : {
            host: cfg.host,
            user: cfg.user,
            port: cfg.port,
            keyPath: cfg.keyPath,
            backendContainer: cfg.backendContainer ?? null,
            defaultSite: form.doDefaultSite,
            deskUrl: form.doDeskUrl,
          },
  });
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  let body: StoredSettings = {};
  try {
    body = (await request.json()) as StoredSettings;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const prev = readStoredSettings();
    const merged: StoredSettings = {
      ...prev,
      cloudProvider:
        body.cloudProvider !== undefined ? body.cloudProvider : prev.cloudProvider,
      doSshHost: body.doSshHost !== undefined ? body.doSshHost : prev.doSshHost,
      doSshUser: body.doSshUser !== undefined ? body.doSshUser : prev.doSshUser,
      doSshPort: body.doSshPort !== undefined ? body.doSshPort : prev.doSshPort,
      doSshKeyPath:
        body.doSshKeyPath !== undefined ? body.doSshKeyPath : prev.doSshKeyPath,
      doBackendContainer:
        body.doBackendContainer !== undefined
          ? body.doBackendContainer
          : prev.doBackendContainer,
      doDefaultSite:
        body.doDefaultSite !== undefined ? body.doDefaultSite : prev.doDefaultSite,
      doDeskUrl: body.doDeskUrl !== undefined ? body.doDeskUrl : prev.doDeskUrl,
    };

    if (typeof body.doDbRootPassword === "string" && body.doDbRootPassword.length > 0) {
      merged.doDbRootPassword = body.doDbRootPassword;
    }
    if (
      typeof body.localDbRootPassword === "string" &&
      body.localDbRootPassword.length > 0
    ) {
      merged.localDbRootPassword = body.localDbRootPassword;
    }

    writeStoredSettings(merged);
    clearCloudContainerCache();

    const form = getSettingsFormValues();
    const cfg = getDoSshConfig();
    return NextResponse.json({
      ok: true,
      settings: form,
      sshReady: !("error" in cfg),
      sshError: "error" in cfg ? cfg.error : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
