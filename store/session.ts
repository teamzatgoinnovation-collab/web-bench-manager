"use client";

import { create } from "zustand";
import type { EnvKey } from "@/lib/shared";
import { DEFAULT_SITE } from "@/lib/shared";

type SessionState = {
  hydrated: boolean;
  authenticated: boolean;
  env: EnvKey;
  site: string;
  setHydrated: (v: boolean) => void;
  setAuthenticated: (v: boolean) => void;
  setEnv: (env: EnvKey) => void;
  setSite: (site: string) => void;
  setPrefs: (prefs: { env: EnvKey; site: string }) => void;
  reset: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  hydrated: false,
  authenticated: false,
  env: "local",
  site: DEFAULT_SITE,
  setHydrated: (hydrated) => set({ hydrated }),
  setAuthenticated: (authenticated) => set({ authenticated }),
  setEnv: (env) => set({ env }),
  setSite: (site) => set({ site }),
  setPrefs: (prefs) => set({ env: prefs.env, site: prefs.site }),
  reset: () =>
    set({
      authenticated: false,
      env: "local",
      site: DEFAULT_SITE,
    }),
}));
