"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { hydrateSession } from "@/lib/client";
import { useSessionStore } from "@/store/session";

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const authenticated = useSessionStore((s) => s.authenticated);
  const hydrated = useSessionStore((s) => s.hydrated);

  useEffect(() => {
    void hydrateSession();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!authenticated) router.replace("/login");
  }, [hydrated, authenticated, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--color-muted-foreground)]">
        Checking session…
      </div>
    );
  }

  if (!authenticated) return null;
  return children;
}
