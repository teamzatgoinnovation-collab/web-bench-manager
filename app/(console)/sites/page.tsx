"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zatgo/ui";
import { toast } from "sonner";
import { DoSshBanner } from "@/components/DoSshBanner";
import { JobLog } from "@/components/JobLog";
import { fetchApps, fetchSites, runManual, savePrefs } from "@/lib/client";
import { useCloudLabel } from "@/lib/use-cloud-label";
import { useJobPoll } from "@/lib/use-job-poll";
import { useSessionStore } from "@/store/session";

export default function SitesPage() {
  const env = useSessionStore((s) => s.env);
  const site = useSessionStore((s) => s.site);
  const cloudLabel = useCloudLabel();
  const [sites, setSites] = useState<string[]>([]);
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [newOpen, setNewOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState("erp.zatgo.online");
  const [adminPassword, setAdminPassword] = useState("");
  const [installErpnext, setInstallErpnext] = useState(true);
  const [setDefault, setSetDefault] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const { log, status, busy, setBusy, setLog, setStatus } = useJobPoll(jobId, (ok) => {
    if (ok) {
      setNewOpen(false);
      void load();
    }
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSites(env);
      setSites(data.sites);
      if (!data.docker.ok) setError(data.docker.stderr || "Backend unreachable");
      const counts: Record<string, number> = {};
      await Promise.all(
        data.sites.map(async (s) => {
          try {
            const apps = await fetchApps(env, s);
            counts[s] = apps.apps.length;
          } catch {
            counts[s] = 0;
          }
        }),
      );
      setAppCounts(counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list sites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  const activate = async (next: string) => {
    try {
      await savePrefs({ env, site: next });
      toast.success(`Active site: ${next}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const createSite = async () => {
    setBusy(true);
    setLog([]);
    setStatus("queued");
    try {
      const out = await runManual({
        action: "new-site",
        env,
        site: newSiteName,
        adminPassword,
        installErpnext,
        setDefault,
      });
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
        title="Sites"
        description={`Sites on the ${env === "cloud" ? cloudLabel : "Local"} bench. Default policy site is erp.zatgo.online.`}
        actions={
          <div className="flex gap-2">
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button>New site</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create site</DialogTitle>
                  <DialogDescription>
                    Runs bench new-site on {env === "cloud" ? cloudLabel : "Local"}. Requires DB root
                    password in Settings.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
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
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={installErpnext}
                      onCheckedChange={(v) => setInstallErpnext(v === true)}
                    />
                    Install ERPNext
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={setDefault}
                      onCheckedChange={(v) => setSetDefault(v === true)}
                    />
                    Set default
                  </label>
                </div>
                {(busy || log.length > 0) && <JobLog lines={log} status={status} />}
                <DialogFooter>
                  <Button
                    disabled={busy || adminPassword.length < 8 || !newSiteName}
                    onClick={() => void createSite()}
                  >
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      <DoSshBanner />

      {error ? (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {sites.includes("frontend") ? (
        <p className="mb-4 rounded-[var(--radius-lg)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Legacy site <strong>frontend</strong> detected. Prefer <code>erp.zatgo.online</code> for
          all ops.
        </p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Site</TableHead>
            <TableHead>Apps</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sites.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-[var(--color-muted-foreground)]">
                {loading ? "Loading…" : "No sites found"}
              </TableCell>
            </TableRow>
          ) : (
            sites.map((s) => (
              <TableRow key={s}>
                <TableCell className="font-medium">
                  <Link href={`/sites/${encodeURIComponent(s)}`} className="underline">
                    {s}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                  {appCounts[s] ?? "—"}
                </TableCell>
                <TableCell>
                  {s === site ? <Badge>active</Badge> : <Badge variant="secondary">idle</Badge>}
                  {s === "erp.zatgo.online" ? (
                    <Badge variant="outline" className="ml-2">
                      canonical
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/sites/${encodeURIComponent(s)}`}>Open</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={s === site}
                      onClick={() => void activate(s)}
                    >
                      Activate
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
