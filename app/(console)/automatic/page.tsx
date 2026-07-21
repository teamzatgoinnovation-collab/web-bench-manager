"use client";

import { useEffect, useState } from "react";
import { Button, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@zatgo/ui";
import { toast } from "sonner";
import { DoSshBanner } from "@/components/DoSshBanner";
import { JobLog } from "@/components/JobLog";
import { fetchApps, fetchJob, runAutomatic } from "@/lib/client";
import { useSessionStore } from "@/store/session";

export default function AutomaticPage() {
  const env = useSessionStore((s) => s.env);
  const site = useSessionStore((s) => s.site);
  const [apps, setApps] = useState<string[]>([]);
  const [buildPkg, setBuildPkg] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [status, setStatus] = useState("idle");

  const loadApps = async () => {
    try {
      const data = await fetchApps(env, site);
      setApps(data.apps);
      if (!buildPkg && data.apps[0]) setBuildPkg(data.apps[0]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to list apps");
    }
  };

  useEffect(() => {
    void loadApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env, site]);

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
          if (data.job.status === "succeeded") {
            toast.success("Done");
            void loadApps();
          } else toast.error(data.job.error || "Failed");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const run = async (action: string, pkg?: string) => {
    setBusy(true);
    setLog([]);
    setStatus("running");
    try {
      const out = await runAutomatic({ action, env, site, package: pkg });
      if (out.async && out.jobId) {
        setJobId(out.jobId);
        return;
      }
      setLog([
        out.result?.command || action,
        out.result?.stdout || "",
        out.result?.stderr || "",
        out.apps ? `apps: ${out.apps.join(", ")}` : "",
      ].filter(Boolean));
      setStatus(out.ok ? "succeeded" : "failed");
      if (out.ok) {
        toast.success(`${action} ok`);
        if (out.apps) setApps(out.apps);
      } else toast.error(out.result?.stderr || `${action} failed`);
      setBusy(false);
    } catch (err) {
      setBusy(false);
      setStatus("failed");
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Automatic"
        description={`Safe bench refresh ops on ${site} (${env === "cloud" ? "DigitalOcean" : "Local"}). Always refreshes list-apps after mutate.`}
      />
      <DoSshBanner />

      <div className="mb-6 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void run("list-apps")}>
          List apps
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => void run("clear-cache")}>
          Clear cache
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => void run("clear-website-cache")}>
          Clear website cache
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => void run("migrate")}>
          Migrate
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <div className="min-w-[200px] flex-1">
          <p className="mb-1 text-xs text-[var(--color-muted-foreground)]">Build app</p>
          <Select value={buildPkg} onValueChange={setBuildPkg}>
            <SelectTrigger>
              <SelectValue placeholder="Select app" />
            </SelectTrigger>
            <SelectContent>
              {apps.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button disabled={busy || !buildPkg} onClick={() => void run("build", buildPkg)}>
          Build --app
        </Button>
      </div>

      <JobLog lines={log} status={status} />
    </div>
  );
}
