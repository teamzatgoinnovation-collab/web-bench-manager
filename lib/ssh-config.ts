import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_DO_SSH_HOST,
  DEFAULT_DO_SSH_PORT,
  DEFAULT_DO_SSH_USER,
  defaultKeyPath,
  isHostedOpsUi,
  readStoredSettings,
} from "./settings-store";

export type DoSshConfig = {
  host: string;
  user: string;
  port: number;
  keyPath: string;
  backendContainer?: string;
  dbRootPassword?: string;
};

const HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const USER_RE = /^[A-Za-z0-9._-]+$/;

export function getLocalDbRootPassword(): string | undefined {
  const stored = readStoredSettings();
  return (
    stored.localDbRootPassword?.trim() ||
    process.env.LOCAL_DB_ROOT_PASSWORD?.trim() ||
    undefined
  );
}

export function getDoSshConfig(): DoSshConfig | { error: string } {
  const stored = readStoredSettings();

  const host =
    stored.doSshHost?.trim() ||
    process.env.DO_SSH_HOST?.trim() ||
    DEFAULT_DO_SSH_HOST;
  const user =
    stored.doSshUser?.trim() ||
    process.env.DO_SSH_USER?.trim() ||
    DEFAULT_DO_SSH_USER;
  const portRaw =
    stored.doSshPort !== undefined
      ? String(stored.doSshPort)
      : process.env.DO_SSH_PORT?.trim() || String(DEFAULT_DO_SSH_PORT);
  const keyPath =
    stored.doSshKeyPath?.trim() ||
    process.env.DO_SSH_KEY_PATH?.trim() ||
    defaultKeyPath();
  const backendContainer =
    stored.doBackendContainer?.trim() ||
    process.env.DO_BACKEND_CONTAINER?.trim() ||
    undefined;
  const dbRootPassword =
    stored.doDbRootPassword?.trim() ||
    process.env.DO_DB_ROOT_PASSWORD?.trim() ||
    undefined;

  if (!host) {
    return {
      error:
        "DigitalOcean SSH not configured: set host in Settings or DO_SSH_HOST",
    };
  }
  if (!HOST_RE.test(host)) {
    return { error: `Invalid DO_SSH_HOST: ${host}` };
  }
  if (!USER_RE.test(user)) {
    return { error: `Invalid DO_SSH_USER: ${user}` };
  }
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: `Invalid DO_SSH_PORT: ${portRaw}` };
  }
  if (!keyPath || !path.isAbsolute(keyPath)) {
    return { error: "DO_SSH_KEY_PATH must be an absolute path" };
  }
  if (isHostedOpsUi()) {
    return {
      error:
        "Cloud SSH only works on your machine. Open http://localhost:3008 — bench.zatgo.online cannot reach your ~/.ssh keys or Docker.",
    };
  }
  const sshDir = path.join(os.homedir(), ".ssh");
  const resolved = path.resolve(keyPath);
  if (!resolved.startsWith(sshDir + path.sep) && resolved !== sshDir) {
    return { error: `DO_SSH_KEY_PATH must be under ${sshDir}` };
  }
  if (!fs.existsSync(resolved)) {
    return { error: `SSH key not found: ${resolved}` };
  }

  return {
    host,
    user,
    port,
    keyPath: resolved,
    backendContainer,
    dbRootPassword,
  };
}

export function isDoSshConfigured(): boolean {
  const cfg = getDoSshConfig();
  return !("error" in cfg);
}

export function redactHost(host: string): string {
  if (host.length <= 8) return "***";
  return `${host.slice(0, 4)}…${host.slice(-4)}`;
}

/** Restore paths must be absolute under known bench dirs. */
export function assertRestorePath(p: string): string {
  if (!/^\/(home\/frappe|tmp)\/[A-Za-z0-9/._-]+$/.test(p)) {
    throw new Error(
      "Restore path must start with /home/frappe/ or /tmp/ and use safe characters only",
    );
  }
  return p;
}

export function assertContainerName(name: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(name) || name.length > 128) {
    throw new Error(`Invalid container name: ${name}`);
  }
  return name;
}
