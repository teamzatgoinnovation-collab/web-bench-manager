"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Checkbox, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { DoSshBanner } from "@/components/DoSshBanner";
import { JobLog } from "@/components/JobLog";
import { fetchCatalog, fetchJob, startDeploy } from "@/lib/client";
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

export default function DeployPage() {
  const env = useSessionStore((s) => s.env);
  const site = useSessionStore((s) => s.site);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [jobId, setJobId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("idle");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const data = await fetchCatalog();
      setCatalog(data.catalog);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load catalog");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await fetchJob(jobId);
        if (cancelled) return;
        setLog(data.job.log);
        setStatus(data.job.status);
        if (data.job.status === "succeeded" || data.job.status === "failed") {
          setBusy(false);
          if (data.job.status === "succeeded") toast.success("Deploy finished");
          else toast.error(data.job.error || "Deploy failed");
          return;
        }
        window.setTimeout(() => void tick(), 1200);
      } catch {
        if (!cancelled) window.setTimeout(() => void tick(), 2000);
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onDeploy = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one app");
      return;
    }
    setBusy(true);
    setLog([]);
    setStatus("queued");
    try {
      const { jobId: id } = await startDeploy({
        env,
        site,
        apps: [...selected],
      });
      setJobId(id);
      toast.message("Deploy started");
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error ? err.message : "Deploy failed to start");
    }
  };

  return (
    <div>
      <PageHeader
        title="Deploy"
        description={`Push WorkSpace remotes (clean + ahead only), then pull/get-app → install → migrate → clear-cache on ${site} (${env === "cloud" ? "DigitalOcean" : "Local"}).`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={busy}>
              Refresh catalog
            </Button>
            <Button onClick={() => void onDeploy()} disabled={busy || selected.size === 0}>
              {busy ? "Running…" : "Run pipeline"}
            </Button>
          </div>
        }
      />

      <DoSshBanner />

      <div className="mb-6 space-y-3">
        {catalog.map((app) => {
          const dirty = app.status && !app.status.clean;
          const ahead = app.status?.ahead ?? 0;
          return (
            <label
              key={app.id}
              className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4"
            >
              <Checkbox
                checked={selected.has(app.id)}
                onCheckedChange={() => toggle(app.id)}
                disabled={busy}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{app.label}</span>
                  <Badge variant="secondary">{app.package}</Badge>
                  {app.status ? (
                    <>
                      <Badge variant={dirty ? "destructive" : "outline"}>
                        {dirty ? "dirty" : "clean"}
                      </Badge>
                      <Badge variant="outline">ahead {ahead}</Badge>
                      <Badge variant="outline">{app.status.branch}</Badge>
                    </>
                  ) : (
                    <Badge variant="destructive">status error</Badge>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-[var(--color-muted-foreground)]">
                  {app.path}
                </p>
                {dirty && app.status?.dirtySummary ? (
                  <pre className="mt-2 max-h-24 overflow-auto text-xs text-amber-700 dark:text-amber-300">
                    {app.status.dirtySummary}
                  </pre>
                ) : null}
                {app.error ? (
                  <p className="mt-1 text-xs text-red-600">{app.error}</p>
                ) : null}
              </div>
            </label>
          );
        })}
      </div>

      <JobLog lines={log} status={status} />
    </div>
  );
}
