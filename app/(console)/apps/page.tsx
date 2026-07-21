"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
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
import { fetchApps } from "@/lib/client";
import { useSessionStore } from "@/store/session";

export default function AppsPage() {
  const env = useSessionStore((s) => s.env);
  const site = useSessionStore((s) => s.site);
  const [apps, setApps] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<Array<{ package: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchApps(env, site);
      setApps(data.apps);
      setCatalog(data.catalog);
      if (!data.docker.ok) toast.error(data.docker.stderr || "list-apps failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to list apps");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env, site]);

  return (
    <div>
      <PageHeader
        title="Apps"
        description={`Installed apps on ${site} (read-only). Use Automatic or Manual for actions.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/automatic">Automatic</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/manual">Manual</Link>
            </Button>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        }
      />
      <DoSshBanner />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>App</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apps.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-[var(--color-muted-foreground)]">
                {loading ? "Loading…" : "No apps listed"}
              </TableCell>
            </TableRow>
          ) : (
            apps.map((a) => {
              const inCatalog = catalog.some((c) => c.package === a);
              return (
                <TableRow key={a}>
                  <TableCell className="font-medium">{a}</TableCell>
                  <TableCell>
                    {inCatalog ? <Badge>catalog</Badge> : <Badge variant="secondary">bench</Badge>}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
