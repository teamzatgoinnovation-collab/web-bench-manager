"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Checkbox, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { JobLog } from "@/components/JobLog";
import { useJobPoll } from "@/lib/use-job-poll";

type Snapshot = {
  target: { host: string; project: string };
  containers: Array<{ name: string; role: string; running: boolean }>;
  sites: Array<{ site: string; apps: string[]; error?: string }>;
  bootApps: string[];
  deployed: Record<string, Record<string, string>>;
  local: Record<string, { head: string | null; dirty: boolean; error?: string }>;
  checkedAt: number;
  canDeploy: boolean;
};
type FleetApps = Record<string, { repo: string; label: string }>;

export default function FleetPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [apps, setApps] = useState<FleetApps>({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selApps, setSelApps] = useState<Set<string>>(new Set());
  const [selSites, setSelSites] = useState<Set<string>>(new Set());
  const [restart, setRestart] = useState(true);
  const [build, setBuild] = useState(false);
  const [allowDirty, setAllowDirty] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const { log, status, busy, setBusy } = useJobPoll(jobId, () => void load());

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/fleet");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSnap(data.snapshot);
      setApps(data.apps);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    fn(n);
  };

  const run = async () => {
    if (!selApps.size) return toast.error("Pick at least one app");
    const msg = `Deploy ${[...selApps].join(", ")} to ${snap?.target.host} (${snap?.containers.filter((c) => c.running).length} containers)` +
      `${selSites.size ? `, migrate ${selSites.size} site(s)` : ", NO migrate"}${restart ? ", restart services" : ""}. Continue?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const res = await fetch("/api/fleet/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apps: [...selApps], sites: [...selSites], restart, build, allowDirty }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      return toast.error(data.error || "Failed to start");
    }
    setJobId(data.jobId);
  };

  const running = snap?.containers.filter((c) => c.running) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hetzner fleet"
        description={snap ? `${snap.target.host} · project ${snap.target.project} · ${running.length}/${snap.containers.length} containers up` : "All sites and custom apps"}
        actions={<Button onClick={() => void load()} disabled={loading || busy}>{loading ? "Checking…" : "Refresh"}</Button>}
      />
      {err ? <div className="rounded border border-red-500/40 p-3 text-sm text-red-500">{err}</div> : null}

      {snap ? (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold">Sites × installed apps</h2>
            <div className="overflow-x-auto rounded border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left">
                    <th className="p-2" />
                    <th className="p-2">Site</th>
                    {snap.bootApps.map((a) => (
                      <th key={a} className="p-2 font-mono text-xs">{a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snap.sites.map((s) => (
                    <tr key={s.site} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="p-2"><Checkbox checked={selSites.has(s.site)} onCheckedChange={() => toggle(selSites, s.site, setSelSites)} /></td>
                      <td className="p-2 font-mono text-xs">{s.site}{s.error ? <span className="ml-2 text-red-500">{s.error}</span> : null}</td>
                      {snap.bootApps.map((a) => (
                        <td key={a} className="p-2">{s.apps.includes(a) ? "●" : <span className="opacity-30">–</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs opacity-60">Tick sites to migrate + clear-cache after the code sync.</p>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Custom apps — local HEAD vs each container</h2>
            <div className="overflow-x-auto rounded border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left">
                    <th className="p-2" />
                    <th className="p-2">App</th>
                    <th className="p-2">Local HEAD</th>
                    {snap.containers.map((c) => (
                      <th key={c.name} className="p-2 text-xs">{c.role}{c.running ? "" : " (down)"}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(apps).map(([pkg, meta]) => {
                    const l = snap.local[pkg];
                    return (
                      <tr key={pkg} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="p-2"><Checkbox checked={selApps.has(pkg)} onCheckedChange={() => toggle(selApps, pkg, setSelApps)} /></td>
                        <td className="p-2">{meta.label}<div className="font-mono text-xs opacity-60">{pkg}</div></td>
                        <td className="p-2 font-mono text-xs">{l?.head ?? "—"}{l?.dirty ? <Badge className="ml-1">dirty</Badge> : null}{l?.error ? <span className="text-red-500"> {l.error}</span> : null}</td>
                        {snap.containers.map((c) => {
                          const v = snap.deployed[pkg]?.[c.name] ?? "?";
                          const ok = v === l?.head;
                          return (
                            <td key={c.name} className={`p-2 font-mono text-xs ${ok ? "text-green-600" : v === "missing" ? "text-red-500" : "text-amber-500"}`}>{v}</td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs opacity-60">
              Containers only show a commit after a sync from this tool (marker file); “unknown” = deployed some other way, “missing” = app dir absent.
            </p>
          </section>

          <section className="space-y-3 rounded border border-[var(--color-border)] p-4">
            <h2 className="text-sm font-semibold">Deploy selected apps</h2>
            <p className="text-xs opacity-70">
              Ships committed HEAD via git archive → scp → docker cp into every running container (the server cannot reach GitHub; apps/ is per-container).
            </p>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={restart} onCheckedChange={(v) => setRestart(v === true)} /> Restart backend/queue/scheduler/websocket</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={build} onCheckedChange={(v) => setBuild(v === true)} /> bench build --app (JS/CSS changed)</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={allowDirty} onCheckedChange={(v) => setAllowDirty(v === true)} /> Allow dirty working tree (uncommitted changes are NOT shipped)</label>
            {!snap.canDeploy ? <p className="text-xs text-amber-500">Hosted copy: code deploy is disabled (no source checkout on the server). Run Bench Manager locally to deploy.</p> : null}
            <Button onClick={() => void run()} disabled={busy || !selApps.size || !snap.canDeploy}>{busy ? "Running…" : "Deploy to Hetzner"}</Button>
          </section>
        </>
      ) : null}

      {jobId ? <JobLog lines={log} status={status} /> : null}
    </div>
  );
}
