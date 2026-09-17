import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env when running from apps/api
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  port: int(process.env.PORT, 3001),
  mockData: bool(process.env.MOCK_DATA, true),
  wallboardTitle: process.env.WALLBOARD_TITLE || "Contact Center Wallboard",
  snapshotIntervalMs: int(process.env.SNAPSHOT_INTERVAL_MS, 30_000),
  displayKey: process.env.DISPLAY_KEY?.trim() || "",
  orgTimezone: process.env.ORG_TIMEZONE || "UTC",
  webex: {
    clientId: process.env.WEBEX_CLIENT_ID || "",
    clientSecret: process.env.WEBEX_CLIENT_SECRET || "",
    accessToken: process.env.WEBEX_ACCESS_TOKEN || "",
    refreshToken: process.env.WEBEX_REFRESH_TOKEN || "",
    orgId: process.env.WEBEX_ORG_ID || "",
    apiBase: (process.env.WXCC_API_BASE || "").replace(/\/$/, ""),
    tokenUrl: "https://webexapis.com/v1/access_token",
  },
};

export function assertLiveConfig(): void {
  const missing: string[] = [];
  if (!config.webex.clientId) missing.push("WEBEX_CLIENT_ID");
  if (!config.webex.clientSecret) missing.push("WEBEX_CLIENT_SECRET");
  if (!config.webex.accessToken && !config.webex.refreshToken) {
    missing.push("WEBEX_ACCESS_TOKEN or WEBEX_REFRESH_TOKEN");
  }
  if (!config.webex.refreshToken) missing.push("WEBEX_REFRESH_TOKEN");
  if (!config.webex.apiBase) missing.push("WXCC_API_BASE");
  if (missing.length) {
    throw new Error(
      `MOCK_DATA=false but missing required env: ${missing.join(", ")}`,
    );
  }
}
