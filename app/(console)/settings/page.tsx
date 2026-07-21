"use client";

import { useEffect, useState } from "react";
import { Button, Input, Label, PageHeader } from "@zatgo/ui";
import { toast } from "sonner";
import { fetchSettings, saveSettings } from "@/lib/client";

export default function SettingsPage() {
  const [host, setHost] = useState("157.230.8.164");
  const [user, setUser] = useState("root");
  const [port, setPort] = useState("22");
  const [keyPath, setKeyPath] = useState("");
  const [container, setContainer] = useState("");
  const [doDbPassword, setDoDbPassword] = useState("");
  const [localDbPassword, setLocalDbPassword] = useState("");
  const [sshReady, setSshReady] = useState<boolean | null>(null);
  const [sshError, setSshError] = useState<string | undefined>();
  const [source, setSource] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSettings();
      setHost(data.settings.doSshHost);
      setUser(data.settings.doSshUser);
      setPort(String(data.settings.doSshPort));
      setKeyPath(data.settings.doSshKeyPath);
      setContainer(data.settings.doBackendContainer || "");
      setSshReady(data.sshReady);
      setSshError(data.sshError);
      setSource(data.settings.source);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const out = await saveSettings({
        doSshHost: host.trim() || "157.230.8.164",
        doSshUser: user.trim() || "root",
        doSshPort: Number(port) || 22,
        doSshKeyPath: keyPath.trim(),
        doBackendContainer: container.trim(),
        ...(doDbPassword ? { doDbRootPassword: doDbPassword } : {}),
        ...(localDbPassword ? { localDbRootPassword: localDbPassword } : {}),
      });
      setSshReady(out.sshReady);
      setSshError(out.sshError);
      setDoDbPassword("");
      setLocalDbPassword("");
      toast.success("Settings saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="DigitalOcean SSH and local DB helpers. Defaults to public IPv4 157.230.8.164. Saved under data/settings.json (not committed)."
      />

      {sshReady === false ? (
        <p className="mb-4 rounded-[var(--radius-lg)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {sshError || "SSH not ready — check host, user, key path."}
        </p>
      ) : sshReady ? (
        <p className="mb-4 text-sm text-[var(--color-muted-foreground)]">
          SSH config looks valid (key present). Switch env to DigitalOcean to use it.
        </p>
      ) : null}

      <form onSubmit={(e) => void onSave(e)} className="max-w-xl space-y-4">
        <div>
          <Label htmlFor="host">DigitalOcean SSH host</Label>
          <Input
            id="host"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="157.230.8.164"
            disabled={loading || busy}
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Source: {source.host ?? "—"} · default public IPv4{" "}
            <code>157.230.8.164</code>
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="user">SSH user</Label>
            <Input
              id="user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              disabled={loading || busy}
            />
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Source: {source.user ?? "—"}
            </p>
          </div>
          <div>
            <Label htmlFor="port">SSH port</Label>
            <Input
              id="port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              disabled={loading || busy}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="key">SSH key path</Label>
          <Input
            id="key"
            value={keyPath}
            onChange={(e) => setKeyPath(e.target.value)}
            placeholder="/home/YOU/.ssh/id_ed25519"
            disabled={loading || busy}
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Must be absolute under ~/.ssh · source: {source.keyPath ?? "—"}
          </p>
        </div>
        <div>
          <Label htmlFor="container">Backend container (optional)</Label>
          <Input
            id="container"
            value={container}
            onChange={(e) => setContainer(e.target.value)}
            placeholder="frappe_docker-backend-1"
            disabled={loading || busy}
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Leave blank to auto-discover a *backend* container over SSH.
          </p>
        </div>
        <div>
          <Label htmlFor="doDb">DO MariaDB root password (optional)</Label>
          <Input
            id="doDb"
            type="password"
            value={doDbPassword}
            onChange={(e) => setDoDbPassword(e.target.value)}
            placeholder="Leave blank to keep unchanged"
            disabled={loading || busy}
          />
        </div>
        <div>
          <Label htmlFor="localDb">Local MariaDB root password (optional)</Label>
          <Input
            id="localDb"
            type="password"
            value={localDbPassword}
            onChange={(e) => setLocalDbPassword(e.target.value)}
            placeholder="Leave blank to keep unchanged"
            disabled={loading || busy}
          />
        </div>
        <Button type="submit" disabled={loading || busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </div>
  );
}
