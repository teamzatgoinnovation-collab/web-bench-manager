import path from "node:path";
import fs from "node:fs";

export {
  DEFAULT_SITE,
  ENV_PRESETS,
  PACKAGE_NAME_RE,
  SITE_NAME_RE,
  assertPackageName,
  assertSiteName,
  isEnvKey,
  isValidPackageName,
  isValidSiteName,
  type EnvKey,
  type EnvPreset,
} from "./shared";

/** Server-only: resolve WorkSpace root for CustomApps git ops. */
export function getWorkspaceRoot(): string {
  if (process.env.WORKSPACE_ROOT) {
    return path.resolve(process.env.WORKSPACE_ROOT);
  }
  // Clients/web/bench-manager → WorkSpace
  const fromCwd = path.resolve(process.cwd(), "../../..");
  if (fs.existsSync(path.join(fromCwd, "CustomApps")) && fs.existsSync(path.join(fromCwd, "ERPNEXT"))) {
    return fromCwd;
  }
  return fromCwd;
}
