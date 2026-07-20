import { NextResponse } from "next/server";
import { isAuthenticated, requireAuthResponse } from "@/lib/auth";
import { CATALOG } from "@/lib/catalog";
import { catalogAppPath } from "@/lib/catalog";
import { gitStatus } from "@/lib/git";

export async function GET() {
  if (!(await isAuthenticated())) return requireAuthResponse();

  const items = await Promise.all(
    CATALOG.map(async (app) => {
      try {
        const status = await gitStatus(app);
        return { ...app, path: catalogAppPath(app), status };
      } catch (err) {
        return {
          ...app,
          path: catalogAppPath(app),
          status: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return NextResponse.json({ catalog: items });
}
