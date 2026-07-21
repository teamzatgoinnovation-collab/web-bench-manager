export type EnvKey = "local" | "cloud";

export type EnvPreset = {
  key: EnvKey;
  label: string;
  backendContainer: string;
  defaultSite: string;
  deskHint: string;
};

export const DEFAULT_SITE = "erp.zatgo.online";

export const ENV_PRESETS: Record<EnvKey, EnvPreset> = {
  local: {
    key: "local",
    label: "Local",
    backendContainer: "erpnext-backend-1",
    defaultSite: DEFAULT_SITE,
    deskHint: "http://localhost:8082",
  },
  cloud: {
    key: "cloud",
    label: "Cloud",
    backendContainer: "frappe_docker-backend-1",
    defaultSite: DEFAULT_SITE,
    deskHint: "https://erp.zatgo.online",
  },
};

export const SITE_NAME_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;
export const PACKAGE_NAME_RE = /^[a-z][a-z0-9_]*$/;

const SITES_SKIP = new Set(["apps", "assets", "common_site_config.json", "apps.txt", "apps.json"]);

export function isValidSiteName(site: string): boolean {
  return SITE_NAME_RE.test(site) && site.length <= 128 && !SITES_SKIP.has(site);
}

export function isValidPackageName(pkg: string): boolean {
  return PACKAGE_NAME_RE.test(pkg) && pkg.length <= 64;
}

export function isEnvKey(value: string): value is EnvKey {
  return value === "local" || value === "cloud";
}

export function assertSiteName(site: string): string {
  if (!isValidSiteName(site)) {
    throw new Error(`Invalid site name: ${site}`);
  }
  return site;
}

export function assertPackageName(pkg: string): string {
  if (!isValidPackageName(pkg)) {
    throw new Error(`Invalid package name: ${pkg}`);
  }
  return pkg;
}
