import { Command } from "cmdk";
import { Search } from "@zatgo/icons";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "./lib/cn";

export type CommandPaletteItem = {
  id: string;
  label: string;
  group?: string;
  shortcut?: string;
  keywords?: string;
  onSelect: () => void;
};

export function CommandPalette({
  items,
  open: openProp,
  onOpenChange,
  placeholder = "Type a command or search…",
  triggerHint = "⌘K",
}: {
  items: CommandPaletteItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  triggerHint?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  const groups = items.reduce<Record<string, CommandPaletteItem[]>>((acc, item) => {
    const key = item.group ?? "Actions";
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className={cn(
        "fixed left-1/2 top-[20%] z-[100] w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-popover)] text-[var(--color-popover-foreground)] shadow-2xl",
      )}
    >
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3">
        <Search className="size-4 shrink-0 text-[var(--color-muted-foreground)]" />
        <Command.Input
          placeholder={placeholder}
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-muted-foreground)]"
        />
        <kbd className="hidden rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-foreground)] sm:inline">
          {triggerHint}
        </kbd>
      </div>
      <Command.List className="max-h-72 overflow-auto p-2">
        <Command.Empty className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">
          No results.
        </Command.Empty>
        {Object.entries(groups).map(([group, groupItems]) => (
          <Command.Group
            key={group}
            heading={group}
            className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--color-muted-foreground)]"
          >
            {groupItems.map((item) => (
              <Command.Item
                key={item.id}
                value={`${item.label} ${item.keywords ?? ""}`}
                onSelect={() => {
                  item.onSelect();
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center justify-between rounded-[var(--radius-md)] px-2 py-2 text-sm aria-selected:bg-[var(--color-accent)] aria-selected:text-[var(--color-accent-foreground)]"
              >
                <span>{item.label}</span>
                {item.shortcut ? (
                  <span className="text-xs text-[var(--color-muted-foreground)]">{item.shortcut}</span>
                ) : null}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}

/** Optional overlay backdrop helper when cmdk Dialog styling needs a dimmer. */
export function CommandPaletteBackdrop({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
