"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Label } from "@zatgo/ui";
import { toast } from "sonner";
import { loginWithToken } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await loginWithToken(token.trim() || "dev-bench-manager-token");
      toast.success("Authenticated");
      router.replace("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-md space-y-4 rounded-[var(--radius-xl)] border border-[var(--color-border)] p-6 shadow-sm"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            ZatGo
          </p>
          <h1 className="text-2xl font-semibold">Bench Manager</h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Local ops console only. Never expose this app publicly — it can run{" "}
            <code className="text-xs">docker exec</code> and <code className="text-xs">git push</code>.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="token">Access token</Label>
          <Input
            id="token"
            type="password"
            autoComplete="current-password"
            placeholder="BENCH_MANAGER_TOKEN"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Dev default with <code>ALLOW_INSECURE_DEV_TOKEN=1</code>:{" "}
            <code>dev-bench-manager-token</code>
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
