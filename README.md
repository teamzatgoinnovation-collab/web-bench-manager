# bench-manager

**Status:** Runnable local ops console  
**Kind:** Next.js  
**Package:** `@zatgo/bench-manager`  
**Port:** 3008  
**Stack:** [FRONTEND_STACK](../../../Docs/Foundation/FRONTEND_STACK.md)

Local-only UI to manage Frappe/ERPNext **benches** (Local vs Cloud), **sites**, and a CustomApps **deploy pipeline** (git push → bench pull/get-app → install → migrate → clear-cache).

## Security

- Requires `BENCH_MANAGER_TOKEN` (httpOnly cookie after login).
- **Never expose publicly** — API routes run `docker exec` and `git push` on the host.
- Bind to localhost; do not put this behind a public reverse proxy without additional controls.

## Run

From the workspace root:

```bash
pnpm install
cp Clients/web/bench-manager/.env.example Clients/web/bench-manager/.env.local
pnpm dev:bench-manager
```

Open [http://localhost:3008](http://localhost:3008). Dev token with `ALLOW_INSECURE_DEV_TOKEN=1`: `dev-bench-manager-token`.

Optional:

```bash
WORKSPACE_ROOT=/absolute/path/to/WorkSpace \
BENCH_MANAGER_TOKEN=… \
pnpm --filter @zatgo/bench-manager dev
```

## Environments

| Env | Backend container | Default site |
|-----|-------------------|--------------|
| Local | `erpnext-backend-1` | `erp.zatgo.online` |
| Cloud | `frappe_docker-backend-1` | `erp.zatgo.online` |

## Deploy pipeline

1. Select catalog apps (ZatGo Core, Tracker, Chat AI)
2. Working trees must be **clean**; only existing commits are pushed (`git push -u origin HEAD`)
3. On bench: `git pull` or `get-app` → `install-app` if needed → `migrate` → `clear-cache` → `list-apps`

## Scripts

| Script | Description |
|--------|-------------|
| `dev` | Next.js on port 3008 |
| `build` | Production build |
| `start` | Serve production build |
| `typecheck` | `tsc --noEmit` |
