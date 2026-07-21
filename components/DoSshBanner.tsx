"use client";

import { useEffect, useState } from "react";
import { fetchEnv } from "@/lib/client";
import { useSessionStore } from "@/store/session";

export function DoSshBanner() {
  const env = useSessionStore((s) => s.env);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (env !== "cloud") {
      setMessage(null);
      return;
    }
    void (async () => {
      try {
        const data = await fetchEnv();
        const cloud = data.health.find((h) => h.env === "cloud");
        if (!data.digitalOcean?.sshConfigured) {
          setMessage(
            "DigitalOcean SSH is not ready. Open Settings to set host (default 157.230.8.164), user, and key path under ~/.ssh.",
          );
          return;
        }
        if (cloud && !cloud.running) {
          setMessage(
            cloud.sshError ||
              `DigitalOcean backend unreachable (${cloud.container}). Check SSH and container health.`,
          );
          return;
        }
        setMessage(null);
      } catch {
        setMessage("Could not load DigitalOcean health.");
      }
    })();
  }, [env]);

  if (!message) return null;

  return (
    <div className="mb-4 rounded-[var(--radius-lg)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
      {message}
    </div>
  );
}
