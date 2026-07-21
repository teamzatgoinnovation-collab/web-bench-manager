"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@zatgo/ui";
import { toast } from "sonner";
import { DoSshBanner } from "@/components/DoSshBanner";
import { JobLog } from "@/components/JobLog";
import {
  fetchApps,
  fetchCatalog,
  fetchSiteBackups,
  fetchSiteOverview,
  runAutomatic,
  runManual,
  savePrefs,
} from "@/lib/client";
import { useJobPoll } from "@/lib/use-job-poll";
import { useSessionStore } from "@/store/session";

const TABS = ["overview", "apps", "backups", "actions"] as const;
type TabId = (typeof TABS)[number];

function isTab(v: string | null): v is TabId {
  return !!v && (TABS as readonly string[]).includes(v);
}

export default function SiteDetailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--color-muted-foreground)]">Loading site…</p>}>
      <SiteDetailContent />
    </Suspense>
  );
}

function SiteDetailContent() {
  const params = useParams<{ site: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const site = decodeURIComponent(params.site || "");
  const env = useSessionStore((s) => s.env);
  const activeSite = useSessionStore((s) => s.site);

  const initialTab = isTab(searchParams.get("tab")) ? searchParams.get("tab")! : "overview";
  const [tab, setTab] = useState<string>(initialTab);

  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchSiteOverview>> | null>(
    null,
  );
  const [apps, setApps] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<Array<{ package: string; label: string }>>([]);
  const [backups, setBackups] = useState<Array<{ name: string; path: string; size: string }>>([]);
  const [loading, setLoading] = useState(true);

  const [jobId, setJobId] = useState<string | null>(null);
  const { log, status, busy, setBusy, setLog, setStatus } = useJobPoll(jobId, (ok) => {
    if (ok) void reload();
  });

  const [installPkg, setInstallPkg] = useState("");
  const [uninstallPkg, setUninstallPkg] = useState("");
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [buildPkg, setBuildPkg] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [withFiles, setWithFiles] = useState(false);
  const [restorePath, setRestorePath] = useState("");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [dropConfirm, setDropConfirm] = useState("");
  const [dropOpen, setDropOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [ov, appsData, cat, bak] = await Promise.all([
        fetchSiteOverview(env, site),
        fetchApps(env, site),
        fetchCatalog(),
        fetchSiteBackups(env, site),
      ]);
      setOverview(ov);
      setApps(appsData.apps);
      setCatalog(cat.catalog.map((c) => ({ package: c.package, label: c.label })));
      setBackups(bak.backups);
      if (!installPkg && cat.catalog[0]) setInstallPkg(cat.catalog[0].package);
      if (!buildPkg && appsData.apps[0]) setBuildPkg(appsData.apps[0]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load site");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env, site]);

  useEffect(() => {
    if (isTab(searchParams.get("tab"))) setTab(searchParams.get("tab")!);
  }, [searchParams]);

  const onTabChange = (next: string) => {
    setTab(next);
    router.replace(`/sites/${encodeURIComponent(site)}?tab=${next}`);
  };

  const startManualJob = async (body: Record<string, unknown>) => {
    setBusy(true);
    setLog([]);
    setStatus("queued");
    try {
      const out = await runManual({ ...body, env, site: (body.site as string) || site });
      if (out.jobId) setJobId(out.jobId);
      else {
        setBusy(false);
        toast.error(out.error || "No job started");
      }
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const startAuto = async (action: string, pkg?: string) => {
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
      ]);
      setStatus(out.ok ? "succeeded" : "failed");
      setBusy(false);
      if (out.ok) {
        toast.success("Done");
        void reload();
      } else toast.error(out.error || "Failed");
    } catch (err) {
      setBusy(false);
      setStatus("failed");
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const activate = async () => {
    try {
      await savePrefs({ env, site });
      toast.success(`Active site: ${site}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const uninstallCandidates = useMemo(
    () => apps.filter((a) => a !== "frappe" && a !== "erpnext"),
    [apps],
  );

  return (
    <div>
      <PageHeader
        title={site}
        description={
          overview
            ? `${overview.appCount} apps · ${overview.health.running ? "backend up" : "backend down"} · ${overview.health.container}`
            : loading
              ? "Loading…"
              : "Site details"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/sites">All sites</Link>
            </Button>
            {site !== activeSite ? (
              <Button variant="outline" onClick={() => void activate()}>
                Set active
              </Button>
            ) : (
              <Badge>active</Badge>
            )}
            <Button variant="outline" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      <DoSshBanner />

      {overview && !overview.exists ? (
        <p className="mb-4 rounded-[var(--radius-lg)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Site not found on this env. It may have been dropped, or Docker is unreachable.
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="apps">Apps</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
              <p className="text-xs text-[var(--color-muted-foreground)]">Backend</p>
              <p className="mt-1 font-medium">{overview?.health.running ? "Running" : "Down"}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {overview?.health.container}
              </p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
              <p className="text-xs text-[var(--color-muted-foreground)]">Installed apps</p>
              <p className="mt-1 text-2xl font-semibold">{overview?.appCount ?? "—"}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
              <p className="text-xs text-[var(--color-muted-foreground)]">Backups</p>
              <p className="mt-1 text-2xl font-semibold">{overview?.backupCount ?? "—"}</p>
              <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                {overview?.lastBackup?.name || "None listed"}
              </p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
              <p className="text-xs text-[var(--color-muted-foreground)]">Desk</p>
              {overview?.deskUrl ? (
                <a
                  href={overview.deskUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-sm underline"
                >
                  {overview.deskUrl}
                </a>
              ) : (
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">—</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void startAuto("clear-cache")}>
              Clear cache
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void startAuto("migrate")}>
              Migrate
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void startManualJob({ action: "backup", withFiles: false })}
            >
              Backup
            </Button>
            <Button size="sm" variant="outline" onClick={() => onTabChange("backups")}>
              View backups
            </Button>
          </div>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">Recent jobs</h2>
              <Link href="/jobs" className="text-sm underline text-[var(--color-muted-foreground)]">
                All jobs
              </Link>
            </div>
            <ul className="space-y-2 text-sm">
              {!overview?.recentJobs.length ? (
                <li className="text-[var(--color-muted-foreground)]">No recent jobs for this site</li>
              ) : (
                overview.recentJobs.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{j.status}</Badge>
                    <Link href={`/jobs/${j.id}`} className="underline">
                      {j.kind}
                    </Link>
                    <span className="text-[var(--color-muted-foreground)]">
                      {new Date(j.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="apps" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {apps.map((a) => (
              <Badge key={a} variant="secondary">
                {a}
              </Badge>
            ))}
            {!apps.length ? (
              <span className="text-sm text-[var(--color-muted-foreground)]">No apps listed</span>
            ) : null}
          </div>

          <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <h2 className="font-medium">Install from catalog</h2>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px]">
                <Label>Package</Label>
                <Select value={installPkg} onValueChange={setInstallPkg}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select app" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.map((c) => (
                      <SelectItem key={c.package} value={c.package}>
                        {c.label} ({c.package})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                disabled={busy || !installPkg}
                onClick={() => void startManualJob({ action: "install-app", package: installPkg })}
              >
                Install
              </Button>
            </div>
          </section>

          <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <h2 className="font-medium">Uninstall</h2>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px]">
                <Label>Package</Label>
                <Select value={uninstallPkg} onValueChange={setUninstallPkg}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select app" />
                  </SelectTrigger>
                  <SelectContent>
                    {uninstallCandidates.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="destructive"
                disabled={busy || !uninstallPkg}
                onClick={() => setUninstallOpen(true)}
              >
                Uninstall…
              </Button>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="backups" className="mt-4 space-y-4">
          <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <h2 className="font-medium">Create backup</h2>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={withFiles} onCheckedChange={(v) => setWithFiles(v === true)} />
              Include files (--with-files)
            </label>
            <Button
              disabled={busy}
              onClick={() => void startManualJob({ action: "backup", withFiles })}
            >
              Run backup
            </Button>
          </section>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Restore</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-[var(--color-muted-foreground)]">
                    No backups found under private/backups
                  </TableCell>
                </TableRow>
              ) : (
                backups.map((b) => (
                  <TableRow key={b.path}>
                    <TableCell className="font-mono text-xs">{b.name}</TableCell>
                    <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                      {b.size}
                    </TableCell>
                    <TableCell className="text-right">
                      {b.name.endsWith(".sql.gz") || b.name.endsWith(".sql") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setRestorePath(b.path);
                            setRestoreOpen(true);
                          }}
                        >
                          Restore…
                        </Button>
                      ) : (
                        <span className="text-xs text-[var(--color-muted-foreground)]">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <h2 className="font-medium">Restore from path</h2>
            <Label>SQL path on bench</Label>
            <Input
              value={restorePath}
              onChange={(e) => setRestorePath(e.target.value)}
              placeholder={`sites/${site}/private/backups/….sql.gz`}
            />
            <Button
              variant="outline"
              disabled={busy || !restorePath}
              onClick={() => setRestoreOpen(true)}
            >
              Restore…
            </Button>
          </section>
        </TabsContent>

        <TabsContent value="actions" className="mt-4 space-y-4">
          <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <h2 className="font-medium">Safe ops</h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => void startAuto("list-apps")}>
                List apps
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void startAuto("clear-cache")}>
                Clear cache
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void startAuto("clear-website-cache")}
              >
                Clear website cache
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void startAuto("migrate")}>
                Migrate
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px]">
                <Label>Build app</Label>
                <Select value={buildPkg} onValueChange={setBuildPkg}>
                  <SelectTrigger>
                    <SelectValue placeholder="App" />
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
              <Button
                size="sm"
                disabled={busy || !buildPkg}
                onClick={() => void startAuto("build", buildPkg)}
              >
                Build
              </Button>
            </div>
          </section>

          <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <h2 className="font-medium">Set admin password</h2>
            <Input
              type="password"
              value={adminPw}
              onChange={(e) => setAdminPw(e.target.value)}
              placeholder="New password (8+ chars)"
            />
            <Button
              disabled={busy || adminPw.length < 8}
              onClick={() =>
                void startManualJob({ action: "set-admin-password", adminPassword: adminPw })
              }
            >
              Update password
            </Button>
          </section>

          <section className="space-y-3 rounded-[var(--radius-lg)] border border-red-500/30 p-4">
            <h2 className="font-medium text-red-700 dark:text-red-300">Drop site</h2>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Type the exact site name to confirm. This cannot be undone from here.
            </p>
            <Input
              value={dropConfirm}
              onChange={(e) => setDropConfirm(e.target.value)}
              placeholder={site}
            />
            <Button
              variant="destructive"
              disabled={busy || dropConfirm !== site}
              onClick={() => setDropOpen(true)}
            >
              Drop site…
            </Button>
          </section>
        </TabsContent>
      </Tabs>

      {(busy || log.length > 0) && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Job output</h2>
            {jobId ? (
              <Link href={`/jobs/${jobId}`} className="text-sm underline">
                Open job
              </Link>
            ) : null}
          </div>
          <JobLog lines={log} status={status} />
        </div>
      )}

      <AlertDialog open={uninstallOpen} onOpenChange={setUninstallOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uninstall {uninstallPkg}?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes the app from {site} and purges leftover Desktop Icons.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setUninstallOpen(false);
                void startManualJob({
                  action: "uninstall-app",
                  package: uninstallPkg,
                  confirmed: true,
                });
              }}
            >
              Uninstall
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Restores <code className="text-xs">{restorePath}</code> onto {site}. Existing data may
              be overwritten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRestoreOpen(false);
                void startManualJob({
                  action: "restore",
                  restorePath,
                  confirmed: true,
                });
              }}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dropOpen} onOpenChange={setDropOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop {site}?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently drops the site database and site folder on this env.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDropOpen(false);
                void startManualJob({ action: "drop-site", confirmSite: site });
              }}
            >
              Drop site
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
