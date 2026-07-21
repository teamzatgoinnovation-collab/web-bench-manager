"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, Button, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { JobLog } from "@/components/JobLog";
import { StageTimeline, type StageRow } from "@/components/StageTimeline";
import { fetchJob } from "@/lib/client";

type JobDetail = {
  id: string;
  kind: string;
  status: string;
  log: string[];
  error?: string;
  createdAt: number;
  updatedAt: number;
  stages?: StageRow[];
  meta?: { env?: string; site?: string };
};

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "succeeded") return "default";
  if (status === "failed") return "destructive";
  if (status === "running" || status === "queued") return "secondary";
  return "outline";
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await fetchJob(id);
        if (cancelled) return;
        setJob(data.job as JobDetail);
        setMissing(false);
        if (data.job.status === "succeeded" || data.job.status === "failed") return;
        window.setTimeout(() => void tick(), 1200);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed";
        if (message.toLowerCase().includes("not found")) {
          setMissing(true);
          return;
        }
        toast.error(message);
        window.setTimeout(() => void tick(), 2000);
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (missing) {
    return (
      <div>
        <PageHeader title="Job not found" description="Jobs are in-memory and cleared on server restart." />
        <Button variant="outline" asChild>
          <Link href="/jobs">Back to jobs</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={job?.kind || "Job"}
        description={
          job
            ? `${[job.meta?.env, job.meta?.site].filter(Boolean).join(" · ") || "—"} · ${new Date(job.createdAt).toLocaleString()}`
            : "Loading…"
        }
        actions={
          <div className="flex items-center gap-2">
            {job ? <Badge variant={statusVariant(job.status)}>{job.status}</Badge> : null}
            <Button variant="outline" asChild>
              <Link href="/jobs">All jobs</Link>
            </Button>
          </div>
        }
      />

      {job?.error ? (
        <p className="mb-4 rounded-[var(--radius-lg)] border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {job.error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
          <h2 className="mb-3 font-medium">Stages</h2>
          <StageTimeline stages={job?.stages || []} />
        </section>
        <JobLog lines={job?.log || []} status={job?.status} />
      </div>
    </div>
  );
}
