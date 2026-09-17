# WxCC Wallboard

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

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | API + Vite (uses `.env`) |
| `npm run dev:mock` | Same with `MOCK_DATA=true` |
| `npm run build` | Build web + API |
| `npm start` | Serve production build (API serves SPA) |

## Deploy overview

1. Push this repo to **GitHub**
2. Host the app (Docker / Node) anywhere with HTTPS + env vars
3. Create & authorize a Webex Contact Center **Service App**
4. Paste client id/secret + access/refresh tokens into host env

Full steps: [docs/deploy.md](docs/deploy.md)

## Architecture

```
TV browser  →  React SPA  →  GET /api/snapshot  →  Node API
                                                   ├─ TokenManager (refresh grant)
                                                   └─ WxCC GraphQL Search
```

## License

Internal / use as you see fit for customer deployments.
