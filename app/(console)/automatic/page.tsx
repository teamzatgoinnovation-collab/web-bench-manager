"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/session";

/** Legacy Automatic → Site Actions */
export default function AutomaticRedirectPage() {
  const router = useRouter();
  const site = useSessionStore((s) => s.site);

  useEffect(() => {
    router.replace(`/sites/${encodeURIComponent(site)}?tab=actions`);
  }, [router, site]);

  return <p className="text-sm text-[var(--color-muted-foreground)]">Redirecting to site actions…</p>;
}
