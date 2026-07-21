import { spawn } from "node:child_process";
import type { EnvKey } from "./config";
import { ENV_PRESETS } from "./config";
import {
  assertContainerName,
  getDoSshConfig,
  isDoSshConfigured,
  redactHost,
  type DoSshConfig,
} from "./ssh-config";

export type RunResult = {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  command: string;
};

const ALLOWED = new Set(["docker", "git", "ssh"]);

let cachedCloudContainer: string | null = null;

function truncate(s: string, max = 200_000): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…[truncated]`;
}

/** Shell-quote a single argument for remote ssh command. */
function shQuote(arg: string): string {
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

export function runCommand(
  command: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv },
): Promise<RunResult> {
  if (!ALLOWED.has(command)) {
    return Promise.resolve({
      ok: false,
      code: 1,
      stdout: "",
      stderr: `Command not allowlisted: ${command}`,
      command: `${command} ${args.join(" ")}`,
    });
  }

  const display = `${command} ${args.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")}`;
  const timeoutMs = opts?.timeoutMs ?? 10 * 60_000;

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: opts?.cwd,
      env: { ...process.env, ...opts?.env },
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGKILL");
      settled = true;
      resolve({
        ok: false,
        code: null,
        stdout: truncate(stdout),
        stderr: truncate(`${stderr}\nTimed out after ${timeoutMs}ms`),
        command: display,
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        code: 1,
        stdout: truncate(stdout),
        stderr: truncate(err.message),
        command: display,
      });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        code,
        stdout: truncate(stdout),
        stderr: truncate(stderr),
        command: display,
      });
    });
  });
}

function sshBaseArgs(cfg: DoSshConfig): string[] {
  return [
    "-i",
    cfg.keyPath,
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-p",
    String(cfg.port),
    `${cfg.user}@${cfg.host}`,
  ];
}

export async function runSsh(remoteCommand: string, opts?: { timeoutMs?: number }): Promise<RunResult> {
  const cfg = getDoSshConfig();
  if ("error" in cfg) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: cfg.error,
      command: "ssh",
    };
  }
  return runCommand("ssh", [...sshBaseArgs(cfg), "--", remoteCommand], opts);
}

function pickBackendContainer(names: string[], preferred?: string): string | null {
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  if (preferred && cleaned.includes(preferred)) return preferred;
  const frappe = cleaned.find((n) => n === "frappe_docker-backend-1");
  if (frappe) return frappe;
  const backend1 = cleaned.find((n) => /backend-1$/.test(n));
  if (backend1) return backend1;
  const anyBackend = cleaned.find((n) => /backend/i.test(n));
  return anyBackend ?? null;
}

export async function discoverCloudContainer(force = false): Promise<{
  container: string | null;
  error?: string;
}> {
  if (!force && cachedCloudContainer) {
    return { container: cachedCloudContainer };
  }
  const cfg = getDoSshConfig();
  if ("error" in cfg) {
    return { container: null, error: cfg.error };
  }
  if (cfg.backendContainer) {
    try {
      const name = assertContainerName(cfg.backendContainer);
      cachedCloudContainer = name;
      return { container: name };
    } catch (err) {
      return { container: null, error: err instanceof Error ? err.message : String(err) };
    }
  }
  const list = await runSsh("docker ps --format '{{.Names}}'");
  if (!list.ok) {
    return { container: null, error: list.stderr || "Failed to list remote containers" };
  }
  const names = list.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  const picked = pickBackendContainer(names);
  if (!picked) {
    return { container: null, error: "No backend container found on DigitalOcean droplet" };
  }
  try {
    cachedCloudContainer = assertContainerName(picked);
    return { container: cachedCloudContainer };
  } catch (err) {
    return { container: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export function localBackendContainer(): string {
  return ENV_PRESETS.local.backendContainer;
}

export async function resolveBackendContainer(env: EnvKey): Promise<{
  container: string;
  error?: string;
}> {
  if (env === "local") {
    return { container: localBackendContainer() };
  }
  const discovered = await discoverCloudContainer();
  if (!discovered.container) {
    return {
      container: ENV_PRESETS.cloud.backendContainer,
      error: discovered.error || "DigitalOcean backend container unknown",
    };
  }
  return { container: discovered.container };
}

/**
 * Run argv inside the backend container (local docker or DO via SSH).
 * argv is executed as: docker exec <container> <argv…>
 */
export async function runOnBench(
  env: EnvKey,
  argv: string[],
  opts?: { timeoutMs?: number },
): Promise<RunResult> {
  for (const a of argv) {
    if (typeof a !== "string" || a.includes("\0")) {
      return {
        ok: false,
        code: 1,
        stdout: "",
        stderr: "Invalid argv token",
        command: argv.join(" "),
      };
    }
  }

  if (env === "local") {
    const container = localBackendContainer();
    return runCommand("docker", ["exec", container, ...argv], opts);
  }

  if (!isDoSshConfigured()) {
    const cfg = getDoSshConfig();
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "error" in cfg ? cfg.error : "DigitalOcean SSH not configured",
      command: "ssh",
    };
  }

  const resolved = await resolveBackendContainer("cloud");
  if (resolved.error && !cachedCloudContainer) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: resolved.error,
      command: "docker exec",
    };
  }
  const container = assertContainerName(resolved.container);
  const remote = ["docker", "exec", container, ...argv].map(shQuote).join(" ");
  return runSsh(remote, opts);
}

/** Run a remote docker CLI command over SSH (not inside the container). */
export async function runRemoteDocker(
  dockerArgv: string[],
  opts?: { timeoutMs?: number },
): Promise<RunResult> {
  if (!isDoSshConfigured()) {
    const cfg = getDoSshConfig();
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "error" in cfg ? cfg.error : "DigitalOcean SSH not configured",
      command: "ssh docker",
    };
  }
  const remote = ["docker", ...dockerArgv].map(shQuote).join(" ");
  return runSsh(remote, opts);
}

export async function dockerContainerRunningLocal(container: string): Promise<boolean> {
  const result = await runCommand("docker", [
    "inspect",
    "-f",
    "{{.State.Running}}",
    container,
  ]);
  return result.ok && result.stdout.trim() === "true";
}

export async function envTransportHealth(env: EnvKey): Promise<{
  env: EnvKey;
  label: string;
  container: string;
  running: boolean;
  transport: "docker" | "ssh";
  sshConfigured?: boolean;
  sshHostRedacted?: string;
  sshError?: string;
}> {
  const preset = ENV_PRESETS[env];
  if (env === "local") {
    const container = localBackendContainer();
    const running = await dockerContainerRunningLocal(container);
    return {
      env,
      label: preset.label,
      container,
      running,
      transport: "docker",
    };
  }

  const cfg = getDoSshConfig();
  if ("error" in cfg) {
    return {
      env,
      label: preset.label,
      container: preset.backendContainer,
      running: false,
      transport: "ssh",
      sshConfigured: false,
      sshError: cfg.error,
    };
  }

  const ping = await runSsh("echo ok", { timeoutMs: 30_000 });
  if (!ping.ok || ping.stdout.trim() !== "ok") {
    return {
      env,
      label: preset.label,
      container: preset.backendContainer,
      running: false,
      transport: "ssh",
      sshConfigured: true,
      sshHostRedacted: redactHost(cfg.host),
      sshError: ping.stderr || "SSH unreachable",
    };
  }

  const discovered = await discoverCloudContainer(true);
  const container = discovered.container || preset.backendContainer;
  const inspect = await runRemoteDocker([
    "inspect",
    "-f",
    "{{.State.Running}}",
    container,
  ]);
  const running = inspect.ok && inspect.stdout.trim() === "true";

  return {
    env,
    label: preset.label,
    container,
    running,
    transport: "ssh",
    sshConfigured: true,
    sshHostRedacted: redactHost(cfg.host),
    sshError: discovered.error || (running ? undefined : inspect.stderr || "Container not running"),
  };
}

// --- Back-compat aliases used by older callers ---

export function backendContainer(env: EnvKey): string {
  if (env === "local") return localBackendContainer();
  return cachedCloudContainer || ENV_PRESETS.cloud.backendContainer;
}

export async function dockerExec(
  _container: string,
  argv: string[],
  opts?: { timeoutMs?: number },
): Promise<RunResult> {
  // Prefer env-aware path; callers that pass container for local keep working via local
  return runCommand("docker", ["exec", _container, ...argv], opts);
}

export async function dockerExecBench(
  env: EnvKey,
  argv: string[],
  opts?: { timeoutMs?: number },
): Promise<RunResult> {
  return runOnBench(env, argv, opts);
}

export async function dockerContainerRunning(container: string): Promise<boolean> {
  return dockerContainerRunningLocal(container);
}
