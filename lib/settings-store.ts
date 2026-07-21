import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  type CloudProvider,
  isCloudProvider,
} from "./cloud-providers";

export type { CloudProvider } from "./cloud-providers";

export type StoredSettings = {
  cloudProvider?: CloudProvider;
  doSshHost?: string;
  doSshUser?: string;
  doSshPort?: number;
  doSshKeyPath?: string;
  doBackendContainer?: string;
  doDefaultSite?: string;
  doDeskUrl?: string;
  /** Stored only if user opts in; prefer env for secrets. */
  doDbRootPassword?: string;
  localDbRootPassword?: string;
};

const HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const USER_RE = /^[A-Za-z0-9._-]+$/;
const SITE_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;
const URL_RE = /^https?:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:\d+)?(\/.*)?$/i;

export const DEFAULT_DO_SSH_HOST = "157.230.8.164";
export const DEFAULT_DO_SSH_USER = "root";
export const DEFAULT_DO_SSH_PORT = 22;
export const DEFAULT_DO_SITE = "erp.zatgo.online";
export const DEFAULT_DO_DESK_URL = "https://erp.zatgo.online";

function isServerlessReadonlyFs(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function isHostedOpsUi(): boolean {
  return isServerlessReadonlyFs();
}

/** Local: `<cwd>/data/settings.json`. Serverless: `/tmp/...` (ephemeral) or refuse writes. */
function settingsPath(): string {
  if (isServerlessReadonlyFs()) {
    return path.join(os.tmpdir(), "zatgo-bench-manager", "settings.json");
  }
  return path.join(process.cwd(), "data", "settings.json");
}

export function assertSettingsWritable(): void {
  if (isServerlessReadonlyFs()) {
    throw new Error(
      "Settings cannot be saved on Vercel (read-only filesystem). Use http://localhost:3008 for Cloud setup, or set DO_SSH_* in Vercel Environment Variables.",
    );
  }
}

export function readStoredSettings(): StoredSettings {
  const file = settingsPath();
  try {
    if (!fs.existsSync(file)) return {};
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as StoredSettings;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeStoredSettings(next: StoredSettings): StoredSettings {
  assertSettingsWritable();
  const file = settingsPath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const cleaned = sanitizeSettings(next);
  fs.writeFileSync(file, `${JSON.stringify(cleaned, null, 2)}\n`, "utf8");
  return cleaned;
}

export function sanitizeSettings(input: StoredSettings): StoredSettings {
  const out: StoredSettings = {};

  if (input.cloudProvider !== undefined) {
    const p = String(input.cloudProvider);
    if (!isCloudProvider(p)) {
      throw new Error(`Invalid cloud provider: ${p}`);
    }
    out.cloudProvider = p;
  }

  if (input.doSshHost !== undefined) {
    const host = String(input.doSshHost).trim();
    if (host && !HOST_RE.test(host)) throw new Error(`Invalid Public IPv4 / host: ${host}`);
    out.doSshHost = host || undefined;
  }
  if (input.doSshUser !== undefined) {
    const user = String(input.doSshUser).trim();
    if (user && !USER_RE.test(user)) throw new Error(`Invalid user: ${user}`);
    out.doSshUser = user || undefined;
  }
  if (input.doSshPort !== undefined && input.doSshPort !== null) {
    const port = Number(input.doSshPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port: ${input.doSshPort}`);
    }
    out.doSshPort = port;
  }
  if (input.doSshKeyPath !== undefined) {
    const keyPath = String(input.doSshKeyPath).trim();
    if (keyPath) {
      if (!path.isAbsolute(keyPath)) throw new Error("Key path must be absolute");
      if (!isServerlessReadonlyFs()) {
        const sshDir = path.join(os.homedir(), ".ssh");
        const resolved = path.resolve(keyPath);
        if (!resolved.startsWith(sshDir + path.sep) && resolved !== sshDir) {
          throw new Error(`Key path must be under ${sshDir}`);
        }
        out.doSshKeyPath = resolved;
      } else {
        out.doSshKeyPath = keyPath;
      }
    }
  }
  if (input.doBackendContainer !== undefined) {
    const c = String(input.doBackendContainer).trim();
    if (c && !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(c)) {
      throw new Error(`Invalid container: ${c}`);
    }
    out.doBackendContainer = c || undefined;
  }
  if (input.doDefaultSite !== undefined) {
    const site = String(input.doDefaultSite).trim();
    if (site && !SITE_RE.test(site)) throw new Error(`Invalid site: ${site}`);
    out.doDefaultSite = site || undefined;
  }
  if (input.doDeskUrl !== undefined) {
    const url = String(input.doDeskUrl).trim();
    if (url && !URL_RE.test(url)) throw new Error(`Invalid Desk URL: ${url}`);
    out.doDeskUrl = url || undefined;
  }
  if (input.doDbRootPassword !== undefined) {
    const p = String(input.doDbRootPassword);
    out.doDbRootPassword = p || undefined;
  }
  if (input.localDbRootPassword !== undefined) {
    const p = String(input.localDbRootPassword);
    out.localDbRootPassword = p || undefined;
  }

  return out;
}

export function defaultKeyPath(): string {
  return path.join(os.homedir(), ".ssh", "id_ed25519");
}

export type SettingsFormValues = {
  cloudProvider: CloudProvider;
  doSshHost: string;
  doSshUser: string;
  doSshPort: number;
  doSshKeyPath: string;
  doBackendContainer: string;
  doDefaultSite: string;
  doDeskUrl: string;
  doDbRootPasswordSet: boolean;
  localDbRootPasswordSet: boolean;
  source: {
    host: "settings" | "env" | "default";
    user: "settings" | "env" | "default";
    port: "settings" | "env" | "default";
    keyPath: "settings" | "env" | "default";
  };
};

/** Effective values for the Settings form (settings → env → defaults). */
export function getSettingsFormValues(): SettingsFormValues {
  const stored = readStoredSettings();

  const host =
    stored.doSshHost ||
    process.env.DO_SSH_HOST?.trim() ||
    DEFAULT_DO_SSH_HOST;
  const user =
    stored.doSshUser ||
    process.env.DO_SSH_USER?.trim() ||
    DEFAULT_DO_SSH_USER;
  const port =
    stored.doSshPort ??
    (process.env.DO_SSH_PORT ? Number(process.env.DO_SSH_PORT) : DEFAULT_DO_SSH_PORT);
  const keyPath =
    stored.doSshKeyPath ||
    process.env.DO_SSH_KEY_PATH?.trim() ||
    defaultKeyPath();
  const backend =
    stored.doBackendContainer ||
    process.env.DO_BACKEND_CONTAINER?.trim() ||
    "";
  const site =
    stored.doDefaultSite ||
    process.env.DO_DEFAULT_SITE?.trim() ||
    DEFAULT_DO_SITE;
  const desk =
    stored.doDeskUrl ||
    process.env.DO_DESK_URL?.trim() ||
    DEFAULT_DO_DESK_URL;

  let cloudProvider: CloudProvider = "digitalocean";
  if (stored.cloudProvider && isCloudProvider(stored.cloudProvider)) {
    cloudProvider = stored.cloudProvider;
  } else if (stored.doSshHost || process.env.DO_SSH_HOST?.trim()) {
    cloudProvider = "digitalocean";
  }

  return {
    cloudProvider,
    doSshHost: host,
    doSshUser: user,
    doSshPort: Number.isFinite(port) ? port : DEFAULT_DO_SSH_PORT,
    doSshKeyPath: keyPath,
    doBackendContainer: backend,
    doDefaultSite: site,
    doDeskUrl: desk,
    doDbRootPasswordSet: Boolean(
      stored.doDbRootPassword || process.env.DO_DB_ROOT_PASSWORD?.trim(),
    ),
    localDbRootPasswordSet: Boolean(
      stored.localDbRootPassword || process.env.LOCAL_DB_ROOT_PASSWORD?.trim(),
    ),
    source: {
      host: stored.doSshHost
        ? "settings"
        : process.env.DO_SSH_HOST?.trim()
          ? "env"
          : "default",
      user: stored.doSshUser
        ? "settings"
        : process.env.DO_SSH_USER?.trim()
          ? "env"
          : "default",
      port: stored.doSshPort !== undefined
        ? "settings"
        : process.env.DO_SSH_PORT
          ? "env"
          : "default",
      keyPath: stored.doSshKeyPath
        ? "settings"
        : process.env.DO_SSH_KEY_PATH?.trim()
          ? "env"
          : "default",
    },
  };
}
