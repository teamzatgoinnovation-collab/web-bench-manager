import { NextResponse } from "next/server";
import { AUTH_COOKIE, expectedToken, verifyToken } from "@/lib/auth";

export async function POST(request: Request) {
  const expected = expectedToken();
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "Server misconfigured: set BENCH_MANAGER_TOKEN or ALLOW_INSECURE_DEV_TOKEN=1",
      },
      { status: 500 },
    );
  }

  let body: { token?: string } = {};
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = body.token?.trim() ?? "";
  if (!verifyToken(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
