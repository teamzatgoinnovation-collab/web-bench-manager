import { spawn } from "node:child_process";
import type { EnvKey } from "./config";
import { ENV_PRESETS } from "./config";

export type RunResult = {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  command: string;
};

const DOCKER_ALLOWED = new Set(["docker"]);

function truncate(s: string, max = 200_000): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…[truncated]`;
}

export function runCommand(
  command: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv },
): Promise<RunResult> {
  if (!DOCKER_ALLOWED.has(command) && command !== "git") {
    return Promise.resolve({
      ok: false,
      code: 1,
      stdout: "",
      stderr: `Command not allowlisted: ${command}`,
      command: `${command} ${args.join(" ")}`,
    });
  }

  const display = `${command} ${args.join(" ")}`;
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

export async function dockerContainerRunning(container: string): Promise<boolean> {
  const result = await runCommand("docker", [
    "inspect",
    "-f",
    "{{.State.Running}}",
    container,
  ]);
  return result.ok && result.stdout.trim() === "true";
}

export async function dockerExec(
  container: string,
  argv: string[],
  opts?: { timeoutMs?: number },
): Promise<RunResult> {
  // docker exec <container> <argv…>
  return runCommand("docker", ["exec", container, ...argv], opts);
}

export function backendContainer(env: EnvKey): string {
  return ENV_PRESETS[env].backendContainer;
}

export async function dockerExecBench(
  env: EnvKey,
  argv: string[],
  opts?: { timeoutMs?: number },
): Promise<RunResult> {
  const container = backendContainer(env);
  return dockerExec(container, argv, opts);
}
