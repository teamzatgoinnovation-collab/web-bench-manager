"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Checkbox, PageHeader, StatCard } from "@zatgo/ui";
import { toast } from "sonner";
import { DoSshBanner } from "@/components/DoSshBanner";
import { JobLog } from "@/components/JobLog";
import { fetchBench, fetchCatalog, startDeploy } from "@/lib/client";
import { useCloudLabel } from "@/lib/use-cloud-label";
import { useJobPoll } from "@/lib/use-job-poll";
import { useSessionStore } from "@/store/session";

type CatalogRow = {
  id: string;
  package: string;
  label: string;
  remote: string;
  path: string;
  status: {
    clean: boolean;
    ahead: number;
    behind: number;
    branch: string;
    dirtySummary: string;
  } | null;
  error?: string;
};

function needsUpdate(row: CatalogRow): boolean {
  if (!row.status) return false;
  return !row.status.clean || row.status.ahead > 0;
}

export default function BenchPage() {
  const env = useSessionStore((s) => s.env);
  const site = useSessionStore((s) => s.site);
  const cloudLabel = useCloudLabel();
  const [bench, setBench] = useState<Awaited<ReturnType<typeof fetchBench>> | null>(null);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const { log, status, busy, setBusy, setLog, setStatus } = useJobPoll(jobId, (ok) => {
    if (ok) void load();
  });

  const load = async () => {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([fetchBench(env), fetchCatalog()]);
      setBench(b);
      setCatalog(c.catalog);
      setSelected((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          if (c.catalog.some((row) => row.id === id && needsUpdate(row))) next.add(id);
        }
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load bench");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  const updates = useMemo(() => catalog.filter(needsUpdate), [catalog]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllUpdates = () => {
    setSelected(new Set(updates.map((u) => u.id)));
  };

  const deploy = async () => {
    if (!selected.size) {
      toast.error("Select at least one app");
      return;
    }
    setBusy(true);
    setLog([]);
    setStatus("queued");
    try {
      const out = await startDeploy({ env, site, apps: [...selected] });
      setJobId(out.jobId);
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error ? err.message : "Deploy failed to start");
    }
  };

  return (
    <div>
      <PageHeader
        title="Bench"
        description={`${env === "cloud" ? cloudLabel : "Local"} · apps on disk, catalog updates, and selective deploy to ${site}.`}
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <DoSshBanner />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Environment"
          value={env === "cloud" ? cloudLabel : "Local"}
          description={bench?.health.container}
        />
        <StatCard
          title="Backend"
          value={bench?.health.running ? "Running" : "Down"}
          description={bench?.health.sshHostRedacted || bench?.health.transport}
        />
        <StatCard title="Sites" value={String(bench?.siteCount ?? "—")} />
        <StatCard
          title="Apps on disk"
          value={String(bench?.appsOnDisk.length ?? "—")}
          description={bench?.appsOnDisk.slice(0, 4).join(", ")}
        />
      </div>

      {updates.length > 0 ? (
        <div className="mb-6 rounded-[var(--radius-lg)] border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="font-medium">Updates available</p>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {updates.length} catalog app{updates.length === 1 ? "" : "s"} have local changes or
            unpushed commits. Select and deploy to {site}.
          </p>
        </div>
      ) : (
        <div className="mb-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
          Catalog apps are clean — no updates detected in the WorkSpace trees.
        </div>
      )}

      <section className="mb-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Catalog / updates</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={selectAllUpdates} disabled={!updates.length}>
              Select updates
            </Button>
            <Button size="sm" disabled={busy || !selected.size} onClick={() => void deploy()}>
              Deploy selected ({selected.size})
            </Button>
          </div>
        </div>

        <ul className="space-y-3">
          {catalog.map((row) => {
            const update = needsUpdate(row);
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3"
              >
                <Checkbox
                  checked={selected.has(row.id)}
                  onCheckedChange={() => toggle(row.id)}
                  disabled={busy}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.label}</span>
                    <Badge variant="outline">{row.package}</Badge>
                    {update ? <Badge variant="warning">update</Badge> : <Badge variant="success">clean</Badge>}
                    {bench?.appsOnDisk.includes(row.package) ? (
                      <Badge variant="secondary">on disk</Badge>
                    ) : (
                      <Badge variant="outline">not on bench</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    {row.status
                      ? `${row.status.branch} · ahead ${row.status.ahead} · behind ${row.status.behind}${
                          row.status.dirtySummary ? ` · ${row.status.dirtySummary}` : ""
                        }`
                      : row.error || "No git status"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <h2 className="mb-3 font-medium">Apps on disk</h2>
        <div className="flex flex-wrap gap-2">
          {(bench?.appsOnDisk || []).map((a) => (
            <Badge key={a} variant="secondary">
              {a}
            </Badge>
          ))}
          {!bench?.appsOnDisk.length ? (
            <span className="text-sm text-[var(--color-muted-foreground)]">None listed</span>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
          Site install state lives under{" "}
          <Link href={`/sites/${encodeURIComponent(site)}?tab=apps`} className="underline">
            {site} → Apps
          </Link>
          .
        </p>
      </section>

      {(busy || log.length > 0) && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Deploy job</h2>
            {jobId ? (
              <Link href={`/jobs/${jobId}`} className="text-sm underline">
                Open job
              </Link>
            ) : null}
          </div>
          <JobLog lines={log} status={status} />
        </div>
      )}
    </div>
  );
}
