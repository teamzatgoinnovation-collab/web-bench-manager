"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
} from "@zatgo/ui";
import { toast } from "sonner";
import { DoSshBanner } from "@/components/DoSshBanner";
import { JobLog } from "@/components/JobLog";
import { fetchApps, fetchCatalog, fetchJob, runManual } from "@/lib/client";
import { useSessionStore } from "@/store/session";

export default function ManualPage() {
  const env = useSessionStore((s) => s.env);
  const site = useSessionStore((s) => s.site);
  const [catalog, setCatalog] = useState<Array<{ package: string; label: string }>>([]);
  const [apps, setApps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [status, setStatus] = useState("idle");

  // new-site
  const [newSiteName, setNewSiteName] = useState("erp.zatgo.online");
  const [adminPassword, setAdminPassword] = useState("");
  const [installErpnext, setInstallErpnext] = useState(true);
  const [setDefault, setSetDefault] = useState(true);

  // install/uninstall
  const [pkg, setPkg] = useState("");
  const [uninstallOpen, setUninstallOpen] = useState(false);

  // set-admin
  const [adminPw, setAdminPw] = useState("");

  // backup/restore
  const [withFiles, setWithFiles] = useState(false);
  const [restorePath, setRestorePath] = useState("");
  const [restoreOpen, setRestoreOpen] = useState(false);

  // drop-site
  const [dropConfirm, setDropConfirm] = useState("");
  const [dropOpen, setDropOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [c, a] = await Promise.all([fetchCatalog(), fetchApps(env, site)]);
        setCatalog(c.catalog.map((x) => ({ package: x.package, label: x.label })));
        setApps(a.apps);
        if (!pkg && c.catalog[0]) setPkg(c.catalog[0].package);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load");
      }
    })();
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
          if (data.job.status === "succeeded") toast.success("Done");
          else toast.error(data.job.error || "Failed");
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

  const start = async (body: Record<string, unknown>) => {
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

  return (
    <div>
      <PageHeader
        title="Manual"
        description="Site lifecycle and install ops. Destructive actions require confirmation."
      />
      <DoSshBanner />

      <section className="mb-6 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <h2 className="font-medium">New site</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Site name</Label>
            <Input value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} />
          </div>
          <div>
            <Label>Admin password</Label>
            <Input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={installErpnext} onCheckedChange={(v) => setInstallErpnext(v === true)} />
            Install ERPNext
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={setDefault} onCheckedChange={(v) => setSetDefault(v === true)} />
            Set default
          </label>
        </div>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Requires {env === "cloud" ? "DO_DB_ROOT_PASSWORD" : "LOCAL_DB_ROOT_PASSWORD"} in .env.local
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            void start({
              action: "new-site",
              site: newSiteName,
              adminPassword,
              installErpnext,
              setDefault,
            })
          }
        >
          Create site
        </Button>
      </section>

      <section className="mb-6 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <h2 className="font-medium">Install / uninstall app</h2>
        <Select value={pkg} onValueChange={setPkg}>
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder="Package" />
          </SelectTrigger>
          <SelectContent>
            {catalog.map((c) => (
              <SelectItem key={c.package} value={c.package}>
                {c.label} ({c.package})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !pkg || apps.includes(pkg)}
            onClick={() => void start({ action: "install-app", package: pkg })}
          >
            Install
          </Button>
          <Button
            variant="outline"
            disabled={busy || !pkg || !apps.includes(pkg)}
            onClick={() => setUninstallOpen(true)}
          >
            Uninstall…
          </Button>
        </div>
      </section>

      <section className="mb-6 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <h2 className="font-medium">Set admin password</h2>
        <Input
          type="password"
          className="max-w-sm"
          placeholder="New admin password"
          value={adminPw}
          onChange={(e) => setAdminPw(e.target.value)}
        />
        <Button
          disabled={busy || adminPw.length < 8}
          onClick={() => void start({ action: "set-admin-password", adminPassword: adminPw })}
        >
          Update password
        </Button>
      </section>

      <section className="mb-6 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <h2 className="font-medium">Backup / restore</h2>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={withFiles} onCheckedChange={(v) => setWithFiles(v === true)} />
          Backup with files
        </label>
        <Button disabled={busy} onClick={() => void start({ action: "backup", withFiles })}>
          Backup
        </Button>
        <div>
          <Label>Restore SQL path (on droplet/container)</Label>
          <Input
            value={restorePath}
            onChange={(e) => setRestorePath(e.target.value)}
            placeholder="/home/frappe/frappe-bench/sites/.../private/backups/….sql.gz"
          />
        </div>
        <Button disabled={busy || !restorePath} variant="outline" onClick={() => setRestoreOpen(true)}>
          Restore…
        </Button>
      </section>

      <section className="mb-6 space-y-3 rounded-[var(--radius-lg)] border border-red-500/30 p-4">
        <h2 className="font-medium text-red-600 dark:text-red-400">Drop site</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Destroys site <code>{site}</code>. Type the site name to confirm.
        </p>
        <Input value={dropConfirm} onChange={(e) => setDropConfirm(e.target.value)} />
        <Button
          variant="destructive"
          disabled={busy || dropConfirm !== site}
          onClick={() => setDropOpen(true)}
        >
          Drop site…
        </Button>
      </section>

      <JobLog lines={log} status={status} />

      <AlertDialog open={uninstallOpen} onOpenChange={setUninstallOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uninstall {pkg}?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes the app from {site}, then purges leftover Desktop Icons and clears cache.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setUninstallOpen(false);
                void start({ action: "uninstall-app", package: pkg, confirmed: true });
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
            <AlertDialogTitle>Restore into {site}?</AlertDialogTitle>
            <AlertDialogDescription>
              Restores from <code>{restorePath}</code>. This can overwrite site data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRestoreOpen(false);
                void start({ action: "restore", restorePath, confirmed: true });
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
            <AlertDialogTitle>Drop {site} permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This runs <code>bench drop-site --force</code>. Irreversible without a backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDropOpen(false);
                void start({ action: "drop-site", confirmSite: dropConfirm });
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
