import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TokenManager } from "./auth/tokenManager.js";
import { config } from "./config.js";
import { SnapshotService } from "./services/snapshotService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireDisplayKey(req: Request, res: Response, next: NextFunction): void {
  if (!config.displayKey) {
    next();
    return;
  }
  const header = req.header("x-display-key");
  const query = typeof req.query.key === "string" ? req.query.key : undefined;
  if (header === config.displayKey || query === config.displayKey) {
    next();
    return;
  }
  res.status(401).json({ error: "Invalid or missing display key" });
}

async function main(): Promise<void> {
  const tokens = new TokenManager();
  const snapshots = new SnapshotService(tokens);
  snapshots.start();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json(snapshots.getHealth());
  });

  app.get("/api/snapshot", requireDisplayKey, (_req, res) => {
    res.json(snapshots.getSnapshot());
  });

  // Production: serve built SPA from apps/web/dist
  const webDist = path.resolve(__dirname, "../../web/dist");
  app.use(express.static(webDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(webDist, "index.html"), (err) => {
      if (err) next();
    });
  });

  app.listen(config.port, () => {
    console.log(
      `[api] listening on :${config.port} (mock=${config.mockData}, interval=${config.snapshotIntervalMs}ms)`,
    );
  });
}

main().catch((err) => {
  console.error("[api] fatal:", err);
  process.exit(1);
});
