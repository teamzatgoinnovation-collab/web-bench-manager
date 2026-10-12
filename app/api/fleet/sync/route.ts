import { NextResponse } from "next/server";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { isValidSiteName } from "@/lib/config";
import { FLEET_APPS, startFleetSyncJob } from "@/lib/fleet";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return requireAuthResponse();
  let body: { apps?: string[]; sites?: string[]; restart?: boolean; build?: boolean; allowDirty?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const apps = Array.isArray(body.apps) ? body.apps : [];
  const sites = Array.isArray(body.sites) ? body.sites : [];
  if (apps.length === 0) return NextResponse.json({ error: "apps required" }, { status: 400 });
  if (apps.some((a) => !(a in FLEET_APPS))) return NextResponse.json({ error: "Unknown fleet app" }, { status: 400 });
  if (sites.some((s) => !isValidSiteName(s))) return NextResponse.json({ error: "Invalid site name" }, { status: 400 });
  const jobId = startFleetSyncJob({
    apps,
    sites,
    restart: body.restart !== false,
    build: body.build === true,
    allowDirty: body.allowDirty === true,
  });
  return NextResponse.json({ ok: true, jobId });
}
