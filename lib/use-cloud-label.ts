"use client";

import { useEffect, useState } from "react";
import { fetchSettings } from "@/lib/client";
import { cloudProviderLabel } from "@/lib/cloud-providers";

/** Active SSH cloud provider label (DigitalOcean / Hetzner / Azure / AWS). */
export function useCloudLabel(fallback = "Cloud") {
  const [label, setLabel] = useState(fallback);

  useEffect(() => {
    void (async () => {
      try {
        const settings = await fetchSettings();
        setLabel(cloudProviderLabel(settings.settings.cloudProvider));
      } catch {
        // keep fallback
      }
    })();
  }, [fallback]);

  return label;
}

export function envDisplayName(env: "local" | "cloud", cloudLabel: string) {
  return env === "cloud" ? cloudLabel : "Local";
}
