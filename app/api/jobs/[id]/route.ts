import { NextResponse } from "next/server";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { getJob, listRecentJobs } from "@/lib/jobs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthenticated())) return requireAuthResponse();

  const { id } = await context.params;
  if (id === "recent") {
    return NextResponse.json({ jobs: listRecentJobs(10) });
  }
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ job });
}
