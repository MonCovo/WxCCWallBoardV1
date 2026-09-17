# Deploy guide — WxCC Wallboard

Repeatable path for a **single-tenant** deployment: host the app, create a Service App, provide keys/secrets.

## 1. Source on GitHub

```bash
git init
git add .
git commit -m "Initial WxCC wallboard"
gh repo create WxCCWallBoard --private --source=. --remote=origin --push
```

Or create an empty GitHub repo and `git remote add origin … && git push -u origin main`.

## 2. Create a Webex Contact Center Service App

Follow: [Introducing Service Apps for Webex Contact Center](https://developer.webex.com/blog/introducing-service-apps-for-webex-contact-center) and [Using Webex Service Apps](https://developer.webex.com/docs/service-apps).

1. Sign in to [developer.webex.com](https://developer.webex.com) → **My Webex Apps** → **Create a Service App**
2. Select Contact Center scopes needed for Search (start with `cjp:config_read`; add more only if your queries require them)
3. Save **Client ID** and **Client Secret**
4. Click **Request Admin Authorization**
5. In [Control Hub](https://admin.webex.com): **Management → Apps → Service Apps** → **Authorize**
6. Back on the Service App page → **Org Authorizations** → select the org → enter client secret → copy **access token** and **refresh token**

## 3. Configure environment

Copy `.env.example` to `.env` (local) or set the same variables in your host’s secret store:

| Variable | Required | Notes |
|----------|----------|-------|
| `WEBEX_CLIENT_ID` | live | Service App client ID |
| `WEBEX_CLIENT_SECRET` | live | Service App client secret |
| `WEBEX_ACCESS_TOKEN` | live | Initial access token from portal |
| `WEBEX_REFRESH_TOKEN` | live | Refresh token; app rotates access |
| `WEBEX_ORG_ID` | recommended | Target org ID |
| `WXCC_API_BASE` | live | Regional base, e.g. `https://api.wxcc-us1.webex.com` (no trailing slash) |
| `MOCK_DATA` | | `false` in production |
| `WALLBOARD_TITLE` | | Display title |
| `SNAPSHOT_INTERVAL_MS` | | Default `30000` |
| `ORG_TIMEZONE` | | IANA tz for start-of-day window (default `UTC`) |
| `DISPLAY_KEY` | optional | If set, require `?key=` or `X-Display-Key` on `/api/snapshot` |
| `PORT` | | Default `3001` |

Tokens are refreshed via `https://webexapis.com/v1/access_token` (`grant_type=refresh_token`). Rotated tokens are persisted under `apps/api/data/tokens.json` when the filesystem is writable (Docker volume recommended).

## 4. Host the application

### Docker Compose

```bash
cp .env.example .env
# edit .env — MOCK_DATA=false + Service App values
docker compose up -d --build
```

Open `https://<your-host>:3001` (terminate TLS at your reverse proxy / platform).

### Node (without Docker)

```bash
npm install
npm run build
MOCK_DATA=false npm start
```

### Platform notes

Any host that supports a container or Node 20+ process and env secrets works: Azure App Service / Container Apps, AWS ECS/App Runner, Render, Railway, a VM behind nginx, etc.

**Do not** use GitHub Pages alone — there is no safe place for Service App secrets in a static site.

## 5. Point the TV at the wallboard

- URL: `https://<your-host>/`
- If `DISPLAY_KEY` is set: `https://<your-host>/?key=<DISPLAY_KEY>`
- Fullscreen the browser; metrics auto-refresh from `/api/snapshot`

## 6. Local IDE testing

```bash
npm install
npm run dev:mock          # no Webex needed
# or
cp .env.example .env      # fill live credentials, MOCK_DATA=false
npm run dev
```

Vite (5173) proxies `/api` to the Express API (3001).

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Badge shows **STALE** | API logs for Search/token errors; scopes; `WXCC_API_BASE` region |
| `Token refresh failed` | Client id/secret/refresh token; Control Hub still authorized |
| Empty queues/KPIs | Org has traffic today; GraphQL field names may need tenant-specific tweaks in `apps/api/src/queries/` |
| 401 on snapshot | `DISPLAY_KEY` mismatch |
