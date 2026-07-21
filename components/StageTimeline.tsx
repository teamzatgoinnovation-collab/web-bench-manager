"use client";

import { Badge, cn } from "@zatgo/ui";

export type StageRow = {
  id: string;
  label: string;
  status: string;
  startedAt?: number;
  finishedAt?: number;
};

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "succeeded") return "default";
  if (status === "failed") return "destructive";
  if (status === "running") return "secondary";
  return "outline";
}

export function StageTimeline({ stages }: { stages: StageRow[] }) {
  if (!stages.length) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">No stages recorded for this job.</p>
    );
  }

  return (
    <ol className="space-y-0">
      {stages.map((stage, index) => {
        const done = stage.status === "succeeded" || stage.status === "skipped";
        const failed = stage.status === "failed";
        const running = stage.status === "running";
        return (
          <li key={stage.id} className="flex gap-3">
            <div className="flex w-5 flex-col items-center">
              <span
                className={cn(
                  "mt-1 size-2.5 shrink-0 rounded-full border-2",
                  done && "border-emerald-600 bg-emerald-600",
                  failed && "border-red-600 bg-red-600",
                  running && "border-sky-500 bg-sky-500 animate-pulse",
                  !done && !failed && !running && "border-[var(--color-border)] bg-transparent",
                )}
              />
              {index < stages.length - 1 ? (
                <span className="my-1 w-px flex-1 bg-[var(--color-border)]" />
              ) : null}
            </div>
            <div className="mb-4 min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{stage.label}</span>
                <Badge variant={statusVariant(stage.status)}>{stage.status}</Badge>
              </div>
              {stage.startedAt ? (
                <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {new Date(stage.startedAt).toLocaleTimeString()}
                  {stage.finishedAt
                    ? ` → ${new Date(stage.finishedAt).toLocaleTimeString()} (${Math.max(0, Math.round((stage.finishedAt - stage.startedAt) / 1000))}s)`
                    : " → …"}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
