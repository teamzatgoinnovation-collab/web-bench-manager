/** SSH-based cloud targets (same transport: SSH → docker exec). */

export const SSH_CLOUD_PROVIDERS = [
  "digitalocean",
  "hetzner",
  "azure",
  "aws",
] as const;

export type SshCloudProvider = (typeof SSH_CLOUD_PROVIDERS)[number];
export type CloudProvider = SshCloudProvider | "none";

export type CloudProviderMeta = {
  id: SshCloudProvider;
  label: string;
  blurb: string;
  hostLabel: string;
  hostHint: string;
  hostPlaceholder: string;
  defaultUser: string;
  machineSection: string;
  dbPasswordLabel: string;
};

export const CLOUD_PROVIDER_META: Record<SshCloudProvider, CloudProviderMeta> = {
  digitalocean: {
    id: "digitalocean",
    label: "DigitalOcean",
    blurb: "Droplet · Public IPv4 · SSH → docker exec",
    hostLabel: "Droplet Public IPv4",
    hostHint: "DO → Droplet → Networking → Public IPv4",
    hostPlaceholder: "157.230.8.164",
    defaultUser: "root",
    machineSection: "DigitalOcean droplet",
    dbPasswordLabel: "Cloud MariaDB root password",
  },
  hetzner: {
    id: "hetzner",
    label: "Hetzner",
    blurb: "Cloud Server · Public IPv4 · SSH → docker exec",
    hostLabel: "Server Public IPv4",
    hostHint: "Hetzner Cloud → Server → Networking → Primary IPv4",
    hostPlaceholder: "1.2.3.4",
    defaultUser: "root",
    machineSection: "Hetzner Cloud Server",
    dbPasswordLabel: "Cloud MariaDB root password",
  },
  azure: {
    id: "azure",
    label: "Azure",
    blurb: "Linux VM · Public IP · SSH → docker exec",
    hostLabel: "VM Public IP",
    hostHint: "Azure Portal → VM → Networking → Public IP address",
    hostPlaceholder: "20.x.x.x",
    defaultUser: "azureuser",
    machineSection: "Azure virtual machine",
    dbPasswordLabel: "Cloud MariaDB root password",
  },
  aws: {
    id: "aws",
    label: "AWS",
    blurb: "EC2 · Public IPv4 · SSH → docker exec",
    hostLabel: "Instance Public IPv4",
    hostHint: "EC2 → Instance → Public IPv4 address (or Elastic IP)",
    hostPlaceholder: "3.x.x.x",
    defaultUser: "ubuntu",
    machineSection: "AWS EC2 instance",
    dbPasswordLabel: "Cloud MariaDB root password",
  },
};

export function isSshCloudProvider(value: string): value is SshCloudProvider {
  return (SSH_CLOUD_PROVIDERS as readonly string[]).includes(value);
}

export function isCloudProvider(value: string): value is CloudProvider {
  return value === "none" || isSshCloudProvider(value);
}

export function cloudProviderLabel(provider: CloudProvider | string | undefined): string {
  if (provider && isSshCloudProvider(provider)) {
    return CLOUD_PROVIDER_META[provider].label;
  }
  return "Cloud";
}
