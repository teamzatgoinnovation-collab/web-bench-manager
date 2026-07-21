import { PanelLeft } from "@zatgo/icons";
import { motion } from "framer-motion";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { useState } from "react";
import { Button } from "./button";
import { cn } from "./lib/cn";

export type AppShellIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export type AppShellNavItem = {
  href: string;
  label: string;
  icon: AppShellIcon;
  end?: boolean;
};

export type AppShellLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

type AppShellLayoutProps = {
  productTitle: string;
  brandLabel?: string;
  nav: AppShellNavItem[];
  pathname: string;
  renderLink: (props: AppShellLinkProps & { end?: boolean; isActive: boolean }) => ReactNode;
  sidebarFooter?: ReactNode;
  headerTitle?: ReactNode;
  headerActions?: ReactNode;
  toolbar?: ReactNode;
  /** When set, replaces the default padded main content (e.g. POS full-bleed workspace). */
  workspace?: ReactNode;
  children?: ReactNode;
  collapsible?: boolean;
  className?: string;
  mainClassName?: string;
};

function isNavActive(pathname: string, href: string, end?: boolean) {
  if (end) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shared product shell: sidebar + header + main.
 * Apps supply nav config and a Link renderer (Next vs Electron).
 */
export function AppShellLayout({
  productTitle,
  brandLabel = "ZatGo",
  nav,
  pathname,
  renderLink,
  sidebarFooter,
  headerTitle,
  headerActions,
  toolbar,
  workspace,
  children,
  collapsible = true,
  className,
  mainClassName,
}: AppShellLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "flex min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]",
        className,
      )}
    >
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--app-sidebar)] transition-[width]",
          collapsed ? "w-16" : "w-56",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-3">
          {!collapsed ? (
            <div className="min-w-0 px-1">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                {brandLabel}
              </p>
              <p className="truncate text-lg font-semibold">{productTitle}</p>
            </div>
          ) : (
            <span className="mx-auto text-sm font-semibold">{productTitle.slice(0, 1)}</span>
          )}
          {collapsible ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft className="size-4" />
            </Button>
          ) : null}
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href, item.end);
            return (
              <div key={item.href}>
                {renderLink({
                  href: item.href,
                  end: item.end,
                  isActive: active,
                  className: cn(
                    "flex items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2 text-sm transition-colors",
                    collapsed && "justify-center px-2",
                    active
                      ? "bg-[var(--app-sidebar-active)] font-medium"
                      : "text-[var(--color-muted-foreground)] hover:bg-[var(--app-sidebar-active)]",
                  ),
                  children: (
                    <>
                      <Icon className="size-4 shrink-0" />
                      {!collapsed ? item.label : null}
                    </>
                  ),
                })}
              </div>
            );
          })}
        </nav>
        {sidebarFooter && !collapsed ? (
          <div className="space-y-2 border-t border-[var(--color-border)] p-3 text-xs text-[var(--color-muted-foreground)]">
            {sidebarFooter}
          </div>
        ) : null}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b border-[var(--color-border)] px-4">
          <div className="min-w-0 text-sm font-medium">{headerTitle}</div>
          <div className="flex items-center gap-2">{headerActions}</div>
        </header>
        {toolbar ? (
          <div className="border-b border-[var(--color-border)] px-4 py-2">{toolbar}</div>
        ) : null}
        {workspace !== undefined ? (
          workspace
        ) : (
          <main className={cn("flex-1 overflow-auto p-6", mainClassName)}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              {children}
            </motion.div>
          </main>
        )}
      </div>
    </div>
  );
}
