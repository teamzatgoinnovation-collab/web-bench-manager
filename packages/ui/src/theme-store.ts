import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
  apply: () => void;
};

function resolveDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function createThemeStore(storageKey = "zatgo-theme") {
  return create<ThemeState>()(
    persist(
      (set, get) => ({
        mode: "system",
        setMode: (mode) => {
          set({ mode });
          get().apply();
        },
        cycleMode: () => {
          const mode = get().mode;
          const next: ThemeMode =
            mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
          get().setMode(next);
        },
        apply: () => {
          if (typeof document === "undefined") return;
          const dark = resolveDark(get().mode);
          document.documentElement.classList.toggle("dark", dark);
        },
      }),
      {
        name: storageKey,
        onRehydrateStorage: () => (state) => {
          state?.apply();
        },
      },
    ),
  );
}

/** Default shared store for apps that do not need a custom storage key. */
export const useThemeStore = createThemeStore("zatgo-theme");
