"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSettings } from "@/lib/client";
import { cloudProviderLabel } from "@/lib/cloud-providers";
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
        const data = await fetchSettings();
        const label = cloudProviderLabel(data.settings.cloudProvider);
        if (!data.sshReady) {
          setMessage(
            `Complete Cloud setup in Settings: choose ${label}, enter Public IP, SSH user/key, then Test connection.`,
          );
          return;
        }
        const cloudHint = data.settings.doSshHost
          ? `${label} ${data.settings.doSshHost}`
          : null;
        if (cloudHint && data.sshError) {
          setMessage(`${cloudHint}: ${data.sshError}`);
          return;
        }
        setMessage(null);
      } catch {
        setMessage("Could not load cloud SSH health. Open Settings to configure.");
      }
    })();
  }, [env]);

  if (!message) return null;

  return (
    <div className="mb-4 rounded-[var(--radius-lg)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
      {message}{" "}
      <Link href="/settings" className="font-medium underline">
        Open Settings
      </Link>
    </div>
  );
}
