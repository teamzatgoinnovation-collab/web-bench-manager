import type { ComponentType, ReactNode, SVGProps } from "react";
import { Button } from "./button";
import { cn } from "./lib/cn";

type Icon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: Icon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)]/40 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-[var(--color-muted)]">
          <Icon className="size-6 text-[var(--color-muted-foreground)]" />
        </div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--color-muted-foreground)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 py-8", className)}>
      <div className="h-4 w-40 animate-pulse rounded bg-[var(--color-muted)]" />
      <div className="h-24 w-full animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-muted)]" />
      <p className="text-sm text-[var(--color-muted-foreground)]">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 px-6 py-8 text-center",
        className,
      )}
    >
      <h3 className="text-base font-semibold text-[var(--color-destructive)]">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{description}</p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
