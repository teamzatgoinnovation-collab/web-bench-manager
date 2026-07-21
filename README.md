# bench-manager

**Status:** Runnable local ops console (Frappe Cloud–style IA)  
**Kind:** Next.js  
**Package:** `@zatgo/bench-manager`  
**Port:** 3008  
**Stack:** [FRONTEND_STACK](../../../Docs/Foundation/FRONTEND_STACK.md)

Local-only UI for Frappe/ERPNext benches: **Local** (host `docker exec`) vs **Cloud** (SSH → remote `docker exec` on DigitalOcean, Hetzner, Azure, or AWS). Console layout mirrors Frappe Cloud (Sites → site detail, Bench updates, Jobs with stages) while staying a privileged localhost ops tool — not a public SaaS.

## Console map

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — env health, updates banner, quick actions, recent jobs |
| `/sites` | Sites list + **New site** |
| `/sites/[site]` | Site detail tabs: Overview · Apps · Backups · Actions |
| `/bench` | Bench identity, catalog update banner, selective deploy |
| `/jobs` · `/jobs/[id]` | Job history with stage timeline + log |
| `/settings` | Cloud SSH provider setup |

Legacy paths redirect: `/automatic` & `/manual` → site Actions; `/apps` & `/deploy` → `/bench`.

## Security

- Requires `BENCH_MANAGER_TOKEN` (httpOnly cookie after login).
- **Never expose publicly** — API routes run `docker` / `ssh` / `git push` on the host.
- SSH private key path must be absolute under `$HOME/.ssh/`. Prefer ssh-agent if the key has a passphrase (`BatchMode=yes` needs an unlocked agent or passphrase-less key).

## Run

```bash
pnpm install
cp Clients/web/bench-manager/.env.example Clients/web/bench-manager/.env.local
# edit .env.local — especially DO_SSH_* for cloud SSH
pnpm dev:bench-manager
```

Open [http://localhost:3008](http://localhost:3008). Dev token with `ALLOW_INSECURE_DEV_TOKEN=1`: `dev-bench-manager-token`.

Desktop shell (Electron, same local ops):

```bash
pnpm dev:bench-manager-desktop
```

See [`Clients/desktop/bench-manager-desktop`](../desktop/bench-manager-desktop).

Flutter client (same API):

```bash
cd Clients/flutter/bench_manager
flutter run -d linux --dart-define=BENCH_MANAGER_URL=http://127.0.0.1:3008
```

See [`Clients/flutter/bench_manager`](../flutter/bench_manager).

## Environments

| Env key | UI label | Transport | Default site |
|---------|----------|-----------|--------------|
| `local` | Local | `docker exec erpnext-backend-1` | `erp.zatgo.online` |
| `cloud` | DigitalOcean / Hetzner / Azure / AWS | SSH then `docker exec` (discover `*backend*`) | `erp.zatgo.online` |

### Cloud setup (Settings UI)

1. Open **Settings**
2. Choose **DigitalOcean**, **Hetzner**, **Azure**, or **AWS** (same SSH → docker exec transport)
3. Enter **Public IPv4**, SSH user/port/key path (defaults: DO/Hetzner `root`, Azure `azureuser`, AWS `ubuntu`)
4. Set production site (`erp.zatgo.online`) and Desk URL
5. **Test connection**, then **Save**
6. Switch env to the selected cloud provider in the header

Values persist in `data/settings.json` (gitignored) and override `.env.local`.

### Cloud SSH `.env.local` (fallback)

```bash
DO_SSH_HOST=157.230.8.164
DO_SSH_USER=root
DO_SSH_PORT=22
DO_SSH_KEY_PATH=/home/YOU/.ssh/id_ed25519
# DO_BACKEND_CONTAINER=frappe_docker-backend-1
# DO_DEFAULT_SITE=erp.zatgo.online
# DO_DESK_URL=https://erp.zatgo.online
# DO_DB_ROOT_PASSWORD=…   # Sites → New site on cloud
# LOCAL_DB_ROOT_PASSWORD=…  # Sites → New site on Local
```

(`DO_SSH_*` names are historical; they apply to any SSH cloud host.)

## Site & bench ops

**Site → Actions / Overview:** list-apps, migrate, clear-cache, clear-website-cache, build --app, set-admin-password, drop-site (confirm).

**Site → Apps:** install from catalog, uninstall + Desktop Icon purge.

**Site → Backups:** list `private/backups`, backup (`--with-files`), restore (confirm; absolute path under `/home/frappe/` or `/tmp/`).

**Bench:** catalog dirty/ahead banner → selective deploy (push → pull/get-app → install → migrate → clear-cache) with staged jobs.

## Scripts

| Script | Description |
|--------|-------------|
| `dev` | Next.js on port 3008 |
| `build` | Production build |
| `start` | Serve production build |
| `typecheck` | `tsc --noEmit` |
