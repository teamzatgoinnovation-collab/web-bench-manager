import { NextResponse } from "next/server";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { discoverCloudContainer, envTransportHealth, runSsh } from "@/lib/exec";
import { getDoSshConfig, redactHost } from "@/lib/ssh-config";

export async function POST() {
  if (!(await isAuthenticated())) return requireAuthResponse();

  const cfg = getDoSshConfig();
  if ("error" in cfg) {
    return NextResponse.json({
      ok: false,
      step: "config",
      error: cfg.error,
    });
  }

  const ping = await runSsh("echo ok", { timeoutMs: 30_000 });
  if (!ping.ok || ping.stdout.trim() !== "ok") {
    return NextResponse.json({
      ok: false,
      step: "ssh",
      host: redactHost(cfg.host),
      error: ping.stderr || "SSH unreachable (check key, user, firewall)",
    });
  }

  const discovered = await discoverCloudContainer(true);
  if (!discovered.container) {
    return NextResponse.json({
      ok: false,
      step: "container",
      host: redactHost(cfg.host),
      error: discovered.error || "No backend container found",
    });
  }

  const health = await envTransportHealth("cloud");

  return NextResponse.json({
    ok: health.running,
    step: health.running ? "ready" : "container",
    host: redactHost(cfg.host),
    container: discovered.container,
    running: health.running,
    error: health.running ? undefined : health.sshError || "Backend container not running",
  });
}
