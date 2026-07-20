"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
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
} from "@zatgo/ui";
import { toast } from "sonner";
import { appsAction, fetchApps } from "@/lib/client";
import { useSessionStore } from "@/store/session";

export default function AppsPage() {
  const env = useSessionStore((s) => s.env);
  const site = useSessionStore((s) => s.site);
  const [apps, setApps] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<
    Array<{ id: string; package: string; label: string }>
  >([]);
  const [installPkg, setInstallPkg] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState("");

  const load = async () => {
    try {
      const data = await fetchApps(env, site);
      setApps(data.apps);
      setCatalog(data.catalog);
      if (!installPkg && data.catalog[0]) setInstallPkg(data.catalog[0].package);
      if (!data.docker.ok) toast.error(data.docker.stderr || "list-apps failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to list apps");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env, site]);

  const run = async (action: string, pkg?: string) => {
    const key = `${action}:${pkg ?? ""}`;
    setBusy(key);
    try {
      const result = await appsAction({ action, env, site, package: pkg });
      setLog(JSON.stringify(result, null, 2));
      if (result.ok === false) {
        toast.error(`${action} failed`);
      } else {
        toast.success(`${action} ok`);
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const catalogNotInstalled = catalog.filter((c) => !apps.includes(c.package));

  return (
    <div>
      <PageHeader
        title="Apps"
        description={`Installed apps on ${site} (${env}). Actions run allowlisted bench commands.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void run("clear-cache")} disabled={!!busy}>
              Clear cache
            </Button>
            <Button variant="outline" onClick={() => void run("migrate")} disabled={!!busy}>
              Migrate
            </Button>
            <Button variant="outline" onClick={() => void load()} disabled={!!busy}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
        <div className="min-w-[200px] flex-1">
          <p className="mb-1 text-xs text-[var(--color-muted-foreground)]">Install from catalog</p>
          <Select value={installPkg} onValueChange={setInstallPkg}>
            <SelectTrigger>
              <SelectValue placeholder="Select package" />
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
          disabled={!installPkg || !!busy || apps.includes(installPkg)}
          onClick={() => void run("install", installPkg)}
        >
          Install
        </Button>
        {catalogNotInstalled.length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            All catalog apps appear installed
          </p>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>App</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apps.map((a) => {
            const inCatalog = catalog.some((c) => c.package === a);
            return (
              <TableRow key={a}>
                <TableCell className="font-medium">{a}</TableCell>
                <TableCell>
                  {inCatalog ? <Badge>catalog</Badge> : <Badge variant="secondary">bench</Badge>}
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  {inCatalog ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => void run("pull", a)}
                    >
                      Pull
                    </Button>
                  ) : null}
                  {a !== "frappe" && a !== "erpnext" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => {
                        if (confirm(`Uninstall ${a} from ${site}?`)) void run("uninstall", a);
                      }}
                    >
                      Uninstall
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {log ? (
        <pre className="mt-6 max-h-64 overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3 text-xs">
          {log}
        </pre>
      ) : null}
    </div>
  );
}
