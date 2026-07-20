"use client";

import { ScrollArea } from "@zatgo/ui";

export function JobLog({ lines, status }: { lines: string[]; status?: string }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-muted)]/30">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
        <span>Job log</span>
        {status ? <span className="font-medium uppercase tracking-wide">{status}</span> : null}
      </div>
      <ScrollArea className="h-[420px]">
        <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-[var(--color-foreground)]">
          {lines.length ? lines.join("\n") : "No output yet."}
        </pre>
      </ScrollArea>
    </div>
  );
}
