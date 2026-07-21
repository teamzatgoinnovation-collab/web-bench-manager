"use client";

import { useEffect, useState } from "react";
import { Button, Input, Label, PageHeader, cn } from "@zatgo/ui";
import { toast } from "sonner";
import {
  fetchSettings,
  savePrefs,
  saveSettings,
  testCloudConnection,
} from "@/lib/client";
import { useSessionStore } from "@/store/session";

type Provider = "digitalocean" | "none";

export default function SettingsPage() {
  const setPrefs = useSessionStore((s) => s.setPrefs);
  const env = useSessionStore((s) => s.env);

  const [provider, setProvider] = useState<Provider>("digitalocean");
  const [host, setHost] = useState("157.230.8.164");
  const [user, setUser] = useState("root");
  const [port, setPort] = useState("22");
  const [keyPath, setKeyPath] = useState("");
  const [container, setContainer] = useState("");
  const [defaultSite, setDefaultSite] = useState("erp.zatgo.online");
  const [deskUrl, setDeskUrl] = useState("https://erp.zatgo.online");
  const [doDbPassword, setDoDbPassword] = useState("");
  const [localDbPassword, setLocalDbPassword] = useState("");
  const [sshReady, setSshReady] = useState<boolean | null>(null);
  const [sshError, setSshError] = useState<string | undefined>();
  const [hosted, setHosted] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSettings();
      setProvider(data.settings.cloudProvider || "digitalocean");
      setHost(data.settings.doSshHost);
      setUser(data.settings.doSshUser);
      setPort(String(data.settings.doSshPort));
      setKeyPath(data.settings.doSshKeyPath);
      setContainer(data.settings.doBackendContainer || "");
      setDefaultSite(data.settings.doDefaultSite || "erp.zatgo.online");
      setDeskUrl(data.settings.doDeskUrl || "https://erp.zatgo.online");
      setSshReady(data.sshReady);
      setSshError(data.sshError);
      setHosted(Boolean(data.hosted));
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
    setTestResult(null);
    try {
      const out = await saveSettings({
        cloudProvider: provider,
        doSshHost: host.trim() || "157.230.8.164",
        doSshUser: user.trim() || "root",
        doSshPort: Number(port) || 22,
        doSshKeyPath: keyPath.trim(),
        doBackendContainer: container.trim(),
        doDefaultSite: defaultSite.trim() || "erp.zatgo.online",
        doDeskUrl: deskUrl.trim() || "https://erp.zatgo.online",
        ...(doDbPassword ? { doDbRootPassword: doDbPassword } : {}),
        ...(localDbPassword ? { localDbRootPassword: localDbPassword } : {}),
      });
      setSshReady(out.sshReady);
      setSshError(out.sshError);
      setDoDbPassword("");
      setLocalDbPassword("");

      if (env === "cloud" && out.settings.doDefaultSite) {
        await savePrefs({ env: "cloud", site: out.settings.doDefaultSite });
        setPrefs({ env: "cloud", site: out.settings.doDefaultSite });
      }

      toast.success("Cloud settings saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Persist current form first so test uses latest values
      await saveSettings({
        cloudProvider: provider,
        doSshHost: host.trim() || "157.230.8.164",
        doSshUser: user.trim() || "root",
        doSshPort: Number(port) || 22,
        doSshKeyPath: keyPath.trim(),
        doBackendContainer: container.trim(),
        doDefaultSite: defaultSite.trim() || "erp.zatgo.online",
        doDeskUrl: deskUrl.trim() || "https://erp.zatgo.online",
      });
      const result = await testCloudConnection();
      if (result.ok) {
        setTestResult(
          `Connected · ${result.host} · container ${result.container} · running`,
        );
        setSshReady(true);
        setSshError(undefined);
        toast.success("Connection OK");
      } else {
        setTestResult(result.error || "Connection failed");
        setSshReady(false);
        setSshError(result.error);
        toast.error(result.error || "Connection failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Test failed";
      setTestResult(msg);
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Production cloud setup: choose a provider, enter droplet Public IPv4 and SSH details, then test the connection. Persist only works on localhost — not on Vercel."
      />

      {hosted ? (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          You are on the <strong>hosted</strong> UI (<code>bench.zatgo.online</code>). Cloud SSH,
          Docker, and Settings save only work on your PC at{" "}
          <a className="font-medium underline" href="http://localhost:3008">
            http://localhost:3008
          </a>
          . Key path like <code>/home/agaib/.ssh/id_ed25519</code> is on your machine, not Vercel.
        </div>
      ) : null}

      {sshReady === false && !hosted ? (
        <p className="mb-4 rounded-[var(--radius-lg)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {sshError || "Cloud SSH not ready — complete DigitalOcean fields below."}
        </p>
      ) : sshReady && !hosted ? (
        <p className="mb-4 text-sm text-[var(--color-muted-foreground)]">
          SSH config looks valid. Use the env switcher → <strong>DigitalOcean</strong> for
          production ops.
        </p>
      ) : null}

      <form onSubmit={(e) => void onSave(e)} className="max-w-2xl space-y-8">
        <fieldset disabled={hosted || loading} className="min-w-0 space-y-8 disabled:opacity-70">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            1. Cloud provider
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={loading || busy}
              onClick={() => setProvider("digitalocean")}
              className={cn(
                "rounded-[var(--radius-lg)] border p-4 text-left transition-colors",
                provider === "digitalocean"
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                  : "border-[var(--color-border)] hover:bg-[var(--color-muted)]/40",
              )}
            >
              <p className="font-medium">DigitalOcean</p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                Droplet · Public IPv4 · SSH → docker exec (production)
              </p>
            </button>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 opacity-50">
              <p className="font-medium">AWS / GCP</p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Coming soon</p>
            </div>
          </div>
        </section>

        {provider === "digitalocean" ? (
          <>
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                2. DigitalOcean droplet
              </h2>
              <div>
                <Label htmlFor="host">Droplet Public IPv4</Label>
                <Input
                  id="host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="157.230.8.164"
                  disabled={loading || busy}
                />
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  From DO → Droplet → Networking → Public IPv4. Default{" "}
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
                <Label htmlFor="key">SSH private key path</Label>
                <Input
                  id="key"
                  value={keyPath}
                  onChange={(e) => setKeyPath(e.target.value)}
                  placeholder="/home/YOU/.ssh/id_ed25519"
                  disabled={loading || busy}
                />
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Absolute path under <code>~/.ssh</code> on this machine (not uploaded).
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                3. Production bench
              </h2>
              <div>
                <Label htmlFor="site">Production site</Label>
                <Input
                  id="site"
                  value={defaultSite}
                  onChange={(e) => setDefaultSite(e.target.value)}
                  placeholder="erp.zatgo.online"
                  disabled={loading || busy}
                />
              </div>
              <div>
                <Label htmlFor="desk">Desk URL</Label>
                <Input
                  id="desk"
                  value={deskUrl}
                  onChange={(e) => setDeskUrl(e.target.value)}
                  placeholder="https://erp.zatgo.online"
                  disabled={loading || busy}
                />
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
                  Leave blank to auto-discover a <code>*backend*</code> container over SSH.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                4. Secrets (optional)
              </h2>
              <div>
                <Label htmlFor="doDb">DO MariaDB root password</Label>
                <Input
                  id="doDb"
                  type="password"
                  value={doDbPassword}
                  onChange={(e) => setDoDbPassword(e.target.value)}
                  placeholder="Leave blank to keep unchanged"
                  disabled={loading || busy}
                />
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Needed for Manual → new-site on DigitalOcean.
                </p>
              </div>
            </section>
          </>
        ) : null}

        <section className="space-y-3 border-t border-[var(--color-border)] pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Local (optional)
          </h2>
          <div>
            <Label htmlFor="localDb">Local MariaDB root password</Label>
            <Input
              id="localDb"
              type="password"
              value={localDbPassword}
              onChange={(e) => setLocalDbPassword(e.target.value)}
              placeholder="Leave blank to keep unchanged"
              disabled={loading || busy}
            />
          </div>
        </section>

        {testResult ? (
          <p
            className={cn(
              "rounded-[var(--radius-lg)] border px-3 py-2 text-sm",
              sshReady
                ? "border-green-500/40 bg-green-500/10"
                : "border-red-500/40 bg-red-500/10",
            )}
          >
            {testResult}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={hosted || loading || busy || testing}>
            {busy ? "Saving…" : "Save settings"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={
              hosted || loading || busy || testing || provider !== "digitalocean"
            }
            onClick={() => void onTest()}
          >
            {testing ? "Testing…" : "Test connection"}
          </Button>
        </div>
        </fieldset>
      </form>
    </div>
  );
}
