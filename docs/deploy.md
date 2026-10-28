# Deploy guide — WxCC Wallboard

Repeatable path for a **single-tenant** deployment: host the app, create a Service App, provide credentials; the wallboard **mints and refreshes tokens** itself.

## 1. Source on GitHub

Repo: https://github.com/MonCovo/WxCCWallBoard (or your fork).

```bash
git clone https://github.com/MonCovo/WxCCWallBoard.git
cd WxCCWallBoard
```

## 2. Create a Webex Contact Center Service App

Follow: [Service Apps for Webex Contact Center](https://developer.webex.com/blog/introducing-service-apps-for-webex-contact-center) and [Using Webex Service Apps](https://developer.webex.com/docs/service-apps).

1. Sign in to [developer.webex.com](https://developer.webex.com) → **My Webex Apps** → **Create a Service App**
2. Scope: **`cjp:config_read`** (required for GraphQL Search)
3. Copy **Client ID**, **Client Secret**, and **Service App ID** (Application ID)
4. Click **Request Admin Authorization**
5. In [Control Hub](https://admin.webex.com): **Management → Apps → Service Apps** → **Authorize**
6. Note your **Org ID** (Control Hub / developer portal)

You do **not** need to copy access/refresh tokens from the portal — the wallboard retrieves them via API.

## 3. Configure environment

Copy `.env.example` to `.env` (local) or set the same variables in your host’s secret store:

| Variable | Required | Notes |
|----------|----------|-------|
| `WEBEX_CLIENT_ID` | live | Service App client ID |
| `WEBEX_CLIENT_SECRET` | live | Service App client secret |
| `WEBEX_APP_ID` | live | Service App / application ID |
| `WEBEX_ORG_ID` | live | Target org ID (`targetOrgId` for token mint) |
| `WEBEX_APPLICATIONS_TOKEN` | live* | See below |
| `WXCC_API_BASE` | live | Regional base, e.g. `https://api.wxcc-eu1.cisco.com` (UK), `https://api.wxcc-eu2.cisco.com` (Germany), `https://api.wxcc-us1.cisco.com` (US) |
| `MOCK_DATA` | | `false` in production |
| `WALLBOARD_TITLE` | | Display title |
| `WALLBOARD_LOGO_URL` | | Header logo URL (defaults to Node4 icon) |
| `SNAPSHOT_INTERVAL_MS` | | Default `30000` |
| `ORG_TIMEZONE` | | IANA tz for start-of-day window (default `UTC`) |
| `DISPLAY_KEY` | optional | If set, require `?key=` or `X-Display-Key` on `/api/snapshot` |
| `PORT` | | Default `3001` |

### Why `WEBEX_APPLICATIONS_TOKEN`?

Webex does not allow minting Service App tokens with only client id/secret. The [Applications Token API](https://developer.webex.com/docs/service-apps) requires a Bearer that is either:

- a **Personal Access Token** from [developer.webex.com](https://developer.webex.com) (simplest for single-tenant), or
- an access token from a **separate Integration** with scope `spark:applications_token`

That Bearer is used **only** to call `POST /v1/applications/{appId}/token`. All Search/GraphQL calls use the **minted Service App** access token. After the first successful mint, tokens are stored under `apps/api/data/tokens.json` and refreshed automatically; the applications token is only needed again if refresh fails (e.g. Control Hub deauthorize).

### Token lifecycle (managed by the app)

```
Startup / expiry
  → refresh_token grant (client id + secret)
  → if that fails → mint via /applications/{appId}/token
  → persist access + refresh to apps/api/data/tokens.json
```

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

Any host that supports a container or Node 20+ process and env secrets works: Azure App Service / Container Apps, AWS ECS/App Runner, Render, Railway, a VM behind nginx, a Raspberry Pi, etc.

**Do not** use GitHub Pages alone — there is no safe place for Service App secrets in a static site.

### Raspberry Pi / Linux kiosk

The stack is OS-agnostic (Node 20+ or Docker). A Pi can be the **server**, the **display**, or both. Use **64-bit Raspberry Pi OS** on a Pi 4/5 (2GB+; 4GB if Chromium kiosk runs on the same box). Always `npm install` *on* the Pi — do not copy Windows `node_modules`.

**Docker:** same `docker compose up -d --build` as above (`node:20-alpine` is linux/arm64). Compose `restart: unless-stopped` is enough; no systemd unit required.

**Node + systemd** (after `npm install && npm run build`, with `.env` at the repo root):

```ini
# /etc/systemd/system/wxcc-wallboard.service
[Unit]
Description=WxCC Wallboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/pi/WxCCWallBoard
Environment=NODE_ENV=production
EnvironmentFile=/home/pi/WxCCWallBoard/.env
ExecStart=/usr/bin/node apps/api/dist/index.js
Restart=on-failure
RestartSec=5
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wxcc-wallboard
```

Adjust `WorkingDirectory`, `User`, and the Node binary path (`which node`) to match the machine. Set `ORG_TIMEZONE` (e.g. `Europe/London`) and keep the Pi on NTP.

**Kiosk display** (same Pi, HDMI to the TV): enable desktop auto-login, disable screen blanking, then autostart Chromium:

```ini
# ~/.config/autostart/wxcc-wallboard.desktop
[Desktop Entry]
Type=Application
Name=WxCC Wallboard
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:3001
X-GNOME-Autostart-enabled=true
```

If `DISPLAY_KEY` is set, use `http://localhost:3001/?key=<DISPLAY_KEY>`. The binary may be `chromium` rather than `chromium-browser`. Other TVs on the LAN can open `http://<pi-hostname>:3001` instead — the API already listens on all interfaces. HTTP is fine on a trusted LAN; put Caddy/nginx in front only if you expose it beyond that.

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
| `Service App token mint failed` | App authorized in Control Hub; `WEBEX_APP_ID` / org ID; `WEBEX_APPLICATIONS_TOKEN` valid |
| `Token refresh failed` | Client id/secret; Control Hub still authorized; app will try re-mint |
| Empty queues/KPIs | Org has traffic today; GraphQL field names may need tenant-specific tweaks in `apps/api/src/queries/` |
| 401 on snapshot | `DISPLAY_KEY` mismatch |
