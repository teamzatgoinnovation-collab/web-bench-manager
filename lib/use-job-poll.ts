"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchJob } from "@/lib/client";

/** Poll a job until terminal; returns log/status helpers for UI. */
export function useJobPoll(jobId: string | null, onDone?: (ok: boolean) => void) {
  const [log, setLog] = useState<string[]>([]);
  const [status, setStatus] = useState("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    setBusy(true);
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await fetchJob(jobId);
        if (cancelled) return;
        setLog(data.job.log);
        setStatus(data.job.status);
        if (data.job.status === "succeeded" || data.job.status === "failed") {
          setBusy(false);
          const ok = data.job.status === "succeeded";
          if (ok) toast.success("Done");
          else toast.error(data.job.error || "Failed");
          onDone?.(ok);
          return;
        }
        window.setTimeout(() => void tick(), 1200);
      } catch {
        if (!cancelled) window.setTimeout(() => void tick(), 2000);
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return { log, status, busy, setBusy, setLog, setStatus };
}
