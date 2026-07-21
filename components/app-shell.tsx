"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Button, cn } from "@zatgo/ui";
import {
  Database,
  LayoutDashboard,
  Layers,
  Moon,
  Package,
  Play,
  Settings,
  SquareMenu,
  Sun,
} from "@zatgo/icons";
import { toast } from "sonner";
import { EnvSwitcher, SitePicker } from "@/components/EnvSwitcher";
import { fetchSites, logout } from "@/lib/client";
import { useSessionStore } from "@/store/session";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { href: "/sites", label: "Sites", icon: Database },
  { href: "/apps", label: "Apps", icon: Package },
  { href: "/automatic", label: "Automatic", icon: Play },
  { href: "/manual", label: "Manual", icon: SquareMenu },
  { href: "/deploy", label: "Deploy", icon: Layers },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const env = useSessionStore((s) => s.env);
  const site = useSessionStore((s) => s.site);
  const mode = theme ?? "system";
  const [sites, setSites] = useState<string[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadSites = async () => {
    setLoadingSites(true);
    try {
      const data = await fetchSites(env);
      setSites(data.sites);
      if (!data.docker.ok) {
        toast.error(data.docker.stderr || "Docker/backend unreachable");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to list sites");
    } finally {
      setLoadingSites(false);
    }
  };

  useEffect(() => {
    void loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  const cycleTheme = () => {
    const next = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
    setTheme(next);
  };

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      toast.success("Signed out");
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--ac-sidebar)]">
        <div className="border-b border-[var(--color-border)] px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            ZatGo
          </p>
          <p className="text-lg font-semibold">Bench Manager</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const isActive = item.end
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-[var(--ac-sidebar-active)] font-medium text-[var(--color-foreground)]"
                    : "text-[var(--color-muted-foreground)] hover:bg-[var(--ac-sidebar-active)] hover:text-[var(--color-foreground)]",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-[var(--color-border)] p-3 text-xs text-[var(--color-muted-foreground)]">
          <p className="font-medium text-[var(--color-foreground)]">
            {env === "cloud" ? "DigitalOcean" : "Local"}
          </p>
          <p className="truncate" title={site}>
            {site}
          </p>
          <p>localhost:3008</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4">
          <div className="flex flex-wrap items-center gap-2">
            <EnvSwitcher />
            <SitePicker sites={sites} loading={loadingSites} />
            <Button variant="outline" size="sm" onClick={() => void loadSites()}>
              Refresh sites
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={signingOut} onClick={() => void onSignOut()}>
              Sign out
            </Button>
            <Button variant="outline" className="gap-2" onClick={cycleTheme}>
              {mode === "dark" ? (
                <Moon className="size-4" />
              ) : mode === "light" ? (
                <Sun className="size-4" />
              ) : (
                <Settings className="size-4" />
              )}
              Theme
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
