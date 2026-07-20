import path from "node:path";
import { getWorkspaceRoot } from "./config";

export type CatalogApp = {
  id: string;
  package: string;
  label: string;
  relativePath: string;
  remote: string;
};

export const CATALOG: CatalogApp[] = [
  {
    id: "zatgo_core",
    package: "zatgo_core",
    label: "ZatGo Core",
    relativePath: "CustomApps/api/ZatGoCore",
    remote: "https://github.com/teamzatgoinnovation-collab/zatgo-core.git",
  },
  {
    id: "tracker",
    package: "tracker",
    label: "Tracker",
    relativePath: "CustomApps/erpnext/Tracker",
    remote: "https://github.com/teamzatgoinnovation-collab/tracker.git",
  },
  {
    id: "chat_ai",
    package: "chat_ai",
    label: "Chat AI",
    relativePath: "CustomApps/erpnext/ChatAI",
    remote: "https://github.com/teamzatgoinnovation-collab/chat-ai.git",
  },
];

export function getCatalogApp(idOrPackage: string): CatalogApp | undefined {
  return CATALOG.find((a) => a.id === idOrPackage || a.package === idOrPackage);
}

export function catalogAppPath(app: CatalogApp): string {
  return path.join(getWorkspaceRoot(), app.relativePath);
}
