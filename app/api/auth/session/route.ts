import { NextResponse } from "next/server";
import { getPrefs, isAuthenticated } from "@/lib/auth";
import { expectedToken } from "@/lib/auth";

export async function GET() {
  const authenticated = await isAuthenticated();
  const prefs = await getPrefs();
  return NextResponse.json({
    authenticated,
    prefs,
    tokenConfigured: Boolean(expectedToken()),
  });
}
