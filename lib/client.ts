"use client";

import { useSessionStore } from "@/store/session";
import type { EnvKey } from "@/lib/shared";

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data;
}

export async function hydrateSession() {
  const store = useSessionStore.getState();
  try {
    const res = await fetch("/api/auth/session");
    const data = await parseJson<{
      authenticated: boolean;
      prefs: { env: EnvKey; site: string };
    }>(res);
    store.setAuthenticated(data.authenticated);
    store.setPrefs(data.prefs);
  } catch {
    store.setAuthenticated(false);
  } finally {
    store.setHydrated(true);
  }
}

export async function loginWithToken(token: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  await parseJson(res);
  useSessionStore.getState().setAuthenticated(true);
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  useSessionStore.getState().reset();
}

export async function savePrefs(prefs: { env: EnvKey; site: string }) {
  const res = await fetch("/api/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  await parseJson(res);
  useSessionStore.getState().setPrefs(prefs);
}

export async function fetchEnv() {
  const res = await fetch("/api/env");
  return parseJson<{
    presets: Array<{
      key: EnvKey;
      label: string;
      backendContainer: string;
      defaultSite: string;
      deskHint: string;
    }>;
    health: Array<{
      env: EnvKey;
      label?: string;
      container: string;
      running: boolean;
      transport?: "docker" | "ssh";
      sshConfigured?: boolean;
      sshHostRedacted?: string;
      sshError?: string;
    }>;
    digitalOcean?: { sshConfigured: boolean };
  }>(res);
}

export async function fetchSites(env: EnvKey) {
  const res = await fetch(`/api/sites?env=${encodeURIComponent(env)}`);
  return parseJson<{
    env: EnvKey;
    sites: string[];
    defaultSite: string;
    selectedSite: string;
    docker: { ok: boolean; stderr: string; command: string };
  }>(res);
}

export async function fetchApps(env: EnvKey, site: string) {
  const res = await fetch(
    `/api/apps?env=${encodeURIComponent(env)}&site=${encodeURIComponent(site)}`,
  );
  return parseJson<{
    env: EnvKey;
    site: string;
    apps: string[];
    catalog: Array<{ id: string; package: string; label: string; remote: string }>;
    docker: { ok: boolean; stderr: string; command: string; stdout: string };
  }>(res);
}

export async function appsAction(body: {
  action: string;
  env: EnvKey;
  site: string;
  package?: string;
}) {
  const res = await fetch("/api/apps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<Record<string, unknown>>(res);
}

export async function fetchCatalog() {
  const res = await fetch("/api/catalog");
  return parseJson<{
    catalog: Array<{
      id: string;
      package: string;
      label: string;
      remote: string;
      path: string;
      status: {
        clean: boolean;
        ahead: number;
        behind: number;
        branch: string;
        dirtySummary: string;
      } | null;
      error?: string;
    }>;
  }>(res);
}

export async function startDeploy(body: { env: EnvKey; site: string; apps: string[] }) {
  const res = await fetch("/api/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<{ ok: boolean; jobId: string }>(res);
}

export async function fetchJob(id: string) {
  const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`);
  return parseJson<{
    job: {
      id: string;
      kind: string;
      status: string;
      log: string[];
      error?: string;
      createdAt: number;
      updatedAt: number;
    };
  }>(res);
}

export async function fetchRecentJobs() {
  const res = await fetch("/api/jobs/recent");
  return parseJson<{
    jobs: Array<{
      id: string;
      kind: string;
      status: string;
      log: string[];
      error?: string;
      createdAt: number;
    }>;
  }>(res);
}

export async function runAutomatic(body: {
  action: string;
  env: EnvKey;
  site: string;
  package?: string;
}) {
  const res = await fetch("/api/bench/automatic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<{
    ok: boolean;
    async?: boolean;
    jobId?: string;
    apps?: string[];
    result?: { stdout?: string; stderr?: string; command?: string };
    error?: string;
  }>(res);
}

export async function runManual(body: Record<string, unknown>) {
  const res = await fetch("/api/bench/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<{ ok: boolean; async?: boolean; jobId?: string; error?: string }>(res);
}
