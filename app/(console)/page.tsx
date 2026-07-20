"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, PageHeader, StatCard } from "@zatgo/ui";
import { toast } from "sonner";
import { fetchApps, fetchEnv, fetchRecentJobs, fetchSites } from "@/lib/client";
import { useSessionStore } from "@/store/session";

export default function DashboardPage() {
  const env = useSessionStore((s) => s.env);
  const site = useSessionStore((s) => s.site);
  const [health, setHealth] = useState<
    Array<{ env: string; container: string; running: boolean }>
  >([]);
  const [sites, setSites] = useState<string[]>([]);
  const [apps, setApps] = useState<string[]>([]);
  const [jobs, setJobs] = useState<
    Array<{ id: string; kind: string; status: string; createdAt: number }>
  >([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [envData, sitesData, appsData, jobsData] = await Promise.all([
        fetchEnv(),
        fetchSites(env),
        fetchApps(env, site),
        fetchRecentJobs(),
      ]);
      setHealth(envData.health);
      setSites(sitesData.sites);
      setApps(appsData.apps);
      setJobs(jobsData.jobs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env, site]);

  const local = health.find((h) => h.env === "local");
  const cloud = health.find((h) => h.env === "cloud");

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Multi-env bench status, active site, and recent deploys."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active env"
          value={env}
          description={local || cloud ? `site ${site}` : undefined}
        />
        <StatCard
          title="Local backend"
          value={local?.running ? "Running" : "Down"}
          description={local?.container}
        />
        <StatCard
          title="Cloud backend"
          value={cloud?.running ? "Running" : "Down"}
          description={cloud?.container}
        />
        <StatCard title="Installed apps" value={String(apps.length)} description={site} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Sites on {env}</h2>
            <Link href="/sites" className="text-sm text-[var(--color-muted-foreground)] underline">
              Manage
            </Link>
          </div>
          {sites.includes("frontend") ? (
            <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
              Legacy site <code>frontend</code> present — prefer{" "}
              <code>erp.zatgo.online</code>.
            </p>
          ) : null}
          <ul className="space-y-1 text-sm">
            {sites.length === 0 ? (
              <li className="text-[var(--color-muted-foreground)]">No sites (is Docker up?)</li>
            ) : (
              sites.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <span>{s}</span>
                  {s === site ? <Badge>active</Badge> : null}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Apps on {site}</h2>
            <Link href="/apps" className="text-sm text-[var(--color-muted-foreground)] underline">
              Manage
            </Link>
          </div>
          <ul className="flex flex-wrap gap-2 text-sm">
            {apps.length === 0 ? (
              <li className="text-[var(--color-muted-foreground)]">None listed</li>
            ) : (
              apps.map((a) => (
                <Badge key={a} variant="secondary">
                  {a}
                </Badge>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Recent jobs</h2>
            <Link href="/deploy" className="text-sm text-[var(--color-muted-foreground)] underline">
              Deploy
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {jobs.length === 0 ? (
              <li className="text-[var(--color-muted-foreground)]">No jobs yet</li>
            ) : (
              jobs.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center gap-2">
                  <Badge variant={j.status === "succeeded" ? "default" : "secondary"}>
                    {j.status}
                  </Badge>
                  <span>{j.kind}</span>
                  <span className="text-[var(--color-muted-foreground)]">
                    {new Date(j.createdAt).toLocaleString()}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
