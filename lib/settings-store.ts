import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type StoredSettings = {
  doSshHost?: string;
  doSshUser?: string;
  doSshPort?: number;
  doSshKeyPath?: string;
  doBackendContainer?: string;
  /** Stored only if user opts in; prefer env for secrets. */
  doDbRootPassword?: string;
  localDbRootPassword?: string;
};

const HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const USER_RE = /^[A-Za-z0-9._-]+$/;

export const DEFAULT_DO_SSH_HOST = "157.230.8.164";
export const DEFAULT_DO_SSH_USER = "root";
export const DEFAULT_DO_SSH_PORT = 22;

function settingsPath(): string {
  return path.join(process.cwd(), "data", "settings.json");
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

  if (input.doSshHost !== undefined) {
    const host = String(input.doSshHost).trim();
    if (host && !HOST_RE.test(host)) throw new Error(`Invalid host: ${host}`);
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
      const sshDir = path.join(os.homedir(), ".ssh");
      const resolved = path.resolve(keyPath);
      if (!resolved.startsWith(sshDir + path.sep) && resolved !== sshDir) {
        throw new Error(`Key path must be under ${sshDir}`);
      }
      out.doSshKeyPath = resolved;
    }
  }
  if (input.doBackendContainer !== undefined) {
    const c = String(input.doBackendContainer).trim();
    if (c && !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(c)) {
      throw new Error(`Invalid container: ${c}`);
    }
    out.doBackendContainer = c || undefined;
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

/** Effective values for the Settings form (settings → env → defaults). */
export function getSettingsFormValues(): {
  doSshHost: string;
  doSshUser: string;
  doSshPort: number;
  doSshKeyPath: string;
  doBackendContainer: string;
  doDbRootPasswordSet: boolean;
  localDbRootPasswordSet: boolean;
  source: {
    host: "settings" | "env" | "default";
    user: "settings" | "env" | "default";
    port: "settings" | "env" | "default";
    keyPath: "settings" | "env" | "default";
  };
} {
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

  return {
    doSshHost: host,
    doSshUser: user,
    doSshPort: Number.isFinite(port) ? port : DEFAULT_DO_SSH_PORT,
    doSshKeyPath: keyPath,
    doBackendContainer: backend,
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
