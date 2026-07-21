"use client";

import { useEffect, useState } from "react";
import { Badge, Button, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@zatgo/ui";
import { toast } from "sonner";
import { fetchSites, savePrefs } from "@/lib/client";
import { useCloudLabel } from "@/lib/use-cloud-label";
import { useSessionStore } from "@/store/session";

export default function SitesPage() {
  const env = useSessionStore((s) => s.env);
  const site = useSessionStore((s) => s.site);
  const cloudLabel = useCloudLabel();
  const [sites, setSites] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSites(env);
      setSites(data.sites);
      if (!data.docker.ok) setError(data.docker.stderr || "Backend unreachable");
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

  return (
    <div>
      <PageHeader
        title="Sites"
        description={`Sites on the ${env === "cloud" ? cloudLabel : "Local"} bench. Default policy site is erp.zatgo.online.`}
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        }
      />

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
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sites.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-[var(--color-muted-foreground)]">
                {loading ? "Loading…" : "No sites found"}
              </TableCell>
            </TableRow>
          ) : (
            sites.map((s) => (
              <TableRow key={s}>
                <TableCell className="font-medium">{s}</TableCell>
                <TableCell>
                  {s === site ? <Badge>active</Badge> : <Badge variant="secondary">idle</Badge>}
                  {s === "erp.zatgo.online" ? (
                    <Badge variant="outline" className="ml-2">
                      canonical
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={s === site}
                    onClick={() => void activate(s)}
                  >
                    Set active
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
