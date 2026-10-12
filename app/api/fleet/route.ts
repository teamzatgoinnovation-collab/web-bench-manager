import { NextResponse } from "next/server";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { FLEET_APPS, fleetSnapshot } from "@/lib/fleet";

export async function GET() {
  if (!(await isAuthenticated())) return requireAuthResponse();
  try {
    const snapshot = await fleetSnapshot();
    return NextResponse.json({ snapshot, apps: FLEET_APPS });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
