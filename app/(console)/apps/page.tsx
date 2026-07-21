"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy Apps → Bench */
export default function AppsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/bench");
  }, [router]);

  return <p className="text-sm text-[var(--color-muted-foreground)]">Redirecting to Bench…</p>;
}
