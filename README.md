# WxCC Wallboard

Community-developed open-source software • Provided as-is without official support

Single-tenant Webex Contact Center TV wallboard. Server-side **Service App** auth, GraphQL Search snapshots, secrets never in the browser.

## Quick start (local IDE / demo)

```bash
git clone <your-github-repo-url>
cd WxCCWallBoard
cp .env.example .env
npm install
npm run dev:mock
```

- UI: http://localhost:5173  
- API: http://localhost:3001 (`/api/health`, `/api/snapshot`)  
- `MOCK_DATA=true` serves wobbling demo metrics (no Webex credentials needed)

For live data, set `MOCK_DATA=false` and fill Service App env vars in `.env` (see [docs/deploy.md](docs/deploy.md)).

<img width="3840" height="2160" alt="image" src="https://github.com/user-attachments/assets/5b769aaf-7044-4c62-9220-5f8995dcc699" />


## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | API + Vite (uses `.env`) |
| `npm run dev:mock` | Same with `MOCK_DATA=true` |
| `npm run build` | Build web + API |
| `npm start` | Serve production build (API serves SPA) |

## Deploy overview

1. Clone from **GitHub**
2. Host the app (Docker / Node) anywhere with HTTPS + env vars
3. Create & authorize a Webex Contact Center **Service App** (`cjp:config_read`)
4. Provide **Client ID**, **Client Secret**, **App ID**, **Org ID**, plus `WEBEX_APPLICATIONS_TOKEN` (PAT used only to mint Service App tokens)
5. The wallboard mints, stores, and refreshes tokens automatically

Full steps: [docs/deploy.md](docs/deploy.md)

## Architecture

```
TV browser  →  React SPA  →  GET /api/snapshot  →  Node API
                                                   ├─ TokenManager (mint + refresh)
                                                   └─ WxCC GraphQL Search
```

## License

Internal / use as you see fit for customer deployments.
