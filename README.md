# bench-manager

**Status:** Runnable local ops console  
**Kind:** Next.js  
**Package:** `@zatgo/bench-manager`  
**Port:** 3008  
**Stack:** [FRONTEND_STACK](../../../Docs/Foundation/FRONTEND_STACK.md)

Local-only UI for Frappe/ERPNext benches: **Local** (host `docker exec`) vs **DigitalOcean** (SSH → remote `docker exec`), sites, Automatic/Manual bench commands, and CustomApps deploy pipeline.

## Security

- Requires `BENCH_MANAGER_TOKEN` (httpOnly cookie after login).
- **Never expose publicly** — API routes run `docker` / `ssh` / `git push` on the host.
- SSH private key path must be absolute under `$HOME/.ssh/`. Prefer ssh-agent if the key has a passphrase (`BatchMode=yes` needs an unlocked agent or passphrase-less key).

## Run

```bash
pnpm install
cp Clients/web/bench-manager/.env.example Clients/web/bench-manager/.env.local
# edit .env.local — especially DO_SSH_* for DigitalOcean
pnpm dev:bench-manager
```

Open [http://localhost:3008](http://localhost:3008). Dev token with `ALLOW_INSECURE_DEV_TOKEN=1`: `dev-bench-manager-token`.

## Environments

| Env key | UI label | Transport | Default site |
|---------|----------|-----------|--------------|
| `local` | Local | `docker exec erpnext-backend-1` | `erp.zatgo.online` |
| `cloud` | DigitalOcean | SSH then `docker exec` (discover `*backend*`) | `erp.zatgo.online` |

### DigitalOcean `.env.local`

Prefer **Settings** in the app (persists to `data/settings.json`). Env is fallback; default host is **`157.230.8.164`**.

```bash
DO_SSH_HOST=157.230.8.164
DO_SSH_USER=root
DO_SSH_PORT=22
DO_SSH_KEY_PATH=/home/YOU/.ssh/id_ed25519
# DO_BACKEND_CONTAINER=frappe_docker-backend-1
# DO_DB_ROOT_PASSWORD=…   # Manual → new-site
# LOCAL_DB_ROOT_PASSWORD=…  # Local → new-site
```

## Commands

**Automatic** (`/automatic`): list-apps, migrate, clear-cache, clear-website-cache, build --app — then refresh.

**Manual** (`/manual`): new-site, install-app, uninstall-app (confirm), set-admin-password, backup, restore (confirm), drop-site (type site name).

**Deploy**: push clean remotes → pull/get-app → install → migrate → clear-cache.

## Scripts

| Script | Description |
|--------|-------------|
| `dev` | Next.js on port 3008 |
| `build` | Production build |
| `start` | Serve production build |
| `typecheck` | `tsc --noEmit` |
