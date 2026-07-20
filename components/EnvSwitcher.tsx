"use client";

import { Button, cn } from "@zatgo/ui";
import type { EnvKey } from "@/lib/shared";
import { useSessionStore } from "@/store/session";
import { savePrefs } from "@/lib/client";
import { toast } from "sonner";

const OPTIONS: { key: EnvKey; label: string }[] = [
  { key: "local", label: "Local" },
  { key: "cloud", label: "Cloud" },
];

export function EnvSwitcher() {
  const env = useSessionStore((s) => s.env);
  const site = useSessionStore((s) => s.site);

  const onSelect = async (next: EnvKey) => {
    if (next === env) return;
    try {
      await savePrefs({ env: next, site });
      toast.success(`Environment: ${next}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch env");
    }
  };

  return (
    <div className="inline-flex rounded-[var(--radius-lg)] border border-[var(--color-border)] p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => void onSelect(opt.key)}
          className={cn(
            "rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium transition-colors",
            env === opt.key
              ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function SitePicker({ sites, loading }: { sites: string[]; loading?: boolean }) {
  const env = useSessionStore((s) => s.env);
  const site = useSessionStore((s) => s.site);

  const onChange = async (next: string) => {
    try {
      await savePrefs({ env, site: next });
      toast.success(`Site: ${next}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to select site");
    }
  };

  return (
    <select
      className="h-9 max-w-[240px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-background)] px-2 text-sm"
      value={sites.includes(site) ? site : sites[0] ?? site}
      disabled={loading || sites.length === 0}
      onChange={(e) => void onChange(e.target.value)}
    >
      {sites.length === 0 ? <option value={site}>{site}</option> : null}
      {sites.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function RefreshSitesButton({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onRefresh}>
      Refresh
    </Button>
  );
}
