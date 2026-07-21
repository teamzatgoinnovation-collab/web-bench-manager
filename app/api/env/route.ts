import { NextResponse } from "next/server";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { ENV_PRESETS, type EnvKey } from "@/lib/config";
import { envHealth } from "@/lib/bench";
import { isDoSshConfigured } from "@/lib/ssh-config";

export async function GET() {
  if (!(await isAuthenticated())) return requireAuthResponse();

  const keys = Object.keys(ENV_PRESETS) as EnvKey[];
  const health = await Promise.all(keys.map((k) => envHealth(k)));

  return NextResponse.json({
    presets: keys.map((k) => ENV_PRESETS[k]),
    health,
    digitalOcean: {
      sshConfigured: isDoSshConfigured(),
    },
  });
}
