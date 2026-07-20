import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { EnvKey } from "./config";
import { DEFAULT_SITE, isEnvKey } from "./config";

export const AUTH_COOKIE = "bm_auth";
export const PREFS_COOKIE = "bm_prefs";

const DEV_PLACEHOLDER = "dev-bench-manager-token";

export function expectedToken(): string {
  const fromEnv = process.env.BENCH_MANAGER_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.ALLOW_INSECURE_DEV_TOKEN === "1") return DEV_PLACEHOLDER;
  return "";
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function verifyToken(token: string): boolean {
  const expected = expectedToken();
  if (!expected || !token) return false;
  return safeEqual(token, expected);
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(AUTH_COOKIE)?.value ?? "";
  return verifyToken(value);
}

export function isAuthenticatedRequest(req: NextRequest): boolean {
  const value = req.cookies.get(AUTH_COOKIE)?.value ?? "";
  return verifyToken(value);
}

export type SessionPrefs = {
  env: EnvKey;
  site: string;
};

export async function getPrefs(): Promise<SessionPrefs> {
  const jar = await cookies();
  const raw = jar.get(PREFS_COOKIE)?.value;
  if (!raw) return { env: "local", site: DEFAULT_SITE };
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { env?: string; site?: string };
    const env = parsed.env && isEnvKey(parsed.env) ? parsed.env : "local";
    const site = typeof parsed.site === "string" && parsed.site ? parsed.site : DEFAULT_SITE;
    return { env, site };
  } catch {
    return { env: "local", site: DEFAULT_SITE };
  }
}

export function encodePrefs(prefs: SessionPrefs): string {
  return encodeURIComponent(JSON.stringify(prefs));
}

export function requireAuthResponse(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
