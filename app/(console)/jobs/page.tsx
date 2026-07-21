"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@zatgo/ui";
import { toast } from "sonner";
import { fetchRecentJobs } from "@/lib/client";

type JobRow = {
  id: string;
  kind: string;
  status: string;
  createdAt: number;
  meta?: { env?: string; site?: string };
  stages?: Array<{ id: string; status: string }>;
};

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "succeeded") return "default";
  if (status === "failed") return "destructive";
  if (status === "running" || status === "queued") return "secondary";
  return "outline";
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchRecentJobs();
      setJobs(data.jobs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Deploy and bench operation history for this session."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Env / Site</TableHead>
            <TableHead>Stages</TableHead>
            <TableHead>Started</TableHead>
            <TableHead className="text-right">Open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-[var(--color-muted-foreground)]">
                {loading ? "Loading…" : "No jobs yet"}
              </TableCell>
            </TableRow>
          ) : (
            jobs.map((j) => (
              <TableRow key={j.id}>
                <TableCell>
                  <Badge variant={statusVariant(j.status)}>{j.status}</Badge>
                </TableCell>
                <TableCell className="font-medium">{j.kind}</TableCell>
                <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                  {[j.meta?.env, j.meta?.site].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                  {j.stages?.length
                    ? `${j.stages.filter((s) => s.status === "succeeded" || s.status === "skipped").length}/${j.stages.length}`
                    : "—"}
                </TableCell>
                <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                  {new Date(j.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/jobs/${j.id}`}>Details</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
