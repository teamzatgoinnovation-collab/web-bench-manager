import { NextResponse } from "next/server";
import { getPrefs, isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { isEnvKey, isValidSiteName } from "@/lib/config";
import { getCatalogApp } from "@/lib/catalog";
import { startDeployJob } from "@/lib/deploy";
import { getJob } from "@/lib/jobs";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  let body: { env?: string; site?: string; apps?: string[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prefs = await getPrefs();
  const env = body.env && isEnvKey(body.env) ? body.env : prefs.env;
  const site = body.site && isValidSiteName(body.site) ? body.site : prefs.site;
  const apps = Array.isArray(body.apps) ? body.apps : [];

  if (apps.length === 0) {
    return NextResponse.json({ error: "apps required" }, { status: 400 });
  }

  for (const id of apps) {
    if (!getCatalogApp(id)) {
      return NextResponse.json({ error: `Unknown catalog app: ${id}` }, { status: 400 });
    }
  }

  const jobId = await startDeployJob({ env, site, apps });
  return NextResponse.json({ ok: true, jobId });
}

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ job });
}
