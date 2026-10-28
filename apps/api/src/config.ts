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

function hhmm(value: string | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(v) ? v : fallback;
}

export const config = {
  port: int(process.env.PORT, 3001),
  mockData: bool(process.env.MOCK_DATA, true),
  wallboardTitle: process.env.WALLBOARD_TITLE || "Contact Center Wallboard",
  wallboardLogoUrl:
    (process.env.WALLBOARD_LOGO_URL ||
      "https://www.n4cdn.com/node4-logos-2024/Node4-Icon-full-colour-Large.png").trim(),
  snapshotIntervalMs: int(process.env.SNAPSHOT_INTERVAL_MS, 30_000),
  displayKey: process.env.DISPLAY_KEY?.trim() || "",
  orgTimezone: process.env.ORG_TIMEZONE || "UTC",
  /**
   * Clock time (HH:MM) in orgTimezone when a new cumulative stats period starts.
   * Default 00:00 = midnight. Combined with statsIntervalHours.
   */
  statsResetAt: hhmm(process.env.STATS_RESET_AT, "00:00"),
  /** Length of each cumulative KPI period. 24 = one period per reset clock time. */
  statsIntervalHours: int(process.env.STATS_INTERVAL_HOURS, 24),
  /**
   * Lookback for live agents / in-queue contacts. Independent of KPI reset so
   * overnight sessions are not dropped when the stats period rolls.
   */
  liveLookbackHours: int(process.env.LIVE_LOOKBACK_HOURS, 168),
  webex: {
    clientId: process.env.WEBEX_CLIENT_ID || "",
    clientSecret: process.env.WEBEX_CLIENT_SECRET || "",
    /** Service App application ID (from developer portal). */
    appId: process.env.WEBEX_APP_ID || "",
    orgId: process.env.WEBEX_ORG_ID || "",
    /**
     * Bearer used only to call POST /v1/applications/{appId}/token.
     * Personal Access Token, or access token from an integration with
     * spark:applications_token. Not used for Search API calls.
     */
    applicationsToken: process.env.WEBEX_APPLICATIONS_TOKEN || "",
    /** Optional legacy overrides if tokens were copied from the portal. */
    accessToken: process.env.WEBEX_ACCESS_TOKEN || "",
    refreshToken: process.env.WEBEX_REFRESH_TOKEN || "",
    apiBase: (process.env.WXCC_API_BASE || "").replace(/\/$/, ""),
    tokenUrl: "https://webexapis.com/v1/access_token",
    applicationsTokenUrl: "https://webexapis.com/v1/applications",
  },
};

export function assertLiveConfig(): void {
  const missing: string[] = [];
  if (!config.webex.clientId) missing.push("WEBEX_CLIENT_ID");
  if (!config.webex.clientSecret) missing.push("WEBEX_CLIENT_SECRET");
  if (!config.webex.appId) missing.push("WEBEX_APP_ID");
  if (!config.webex.orgId) missing.push("WEBEX_ORG_ID");
  if (!config.webex.apiBase) missing.push("WXCC_API_BASE");

  const canMint = Boolean(config.webex.applicationsToken);
  const hasLegacyTokens = Boolean(
    config.webex.refreshToken || config.webex.accessToken,
  );
  if (!canMint && !hasLegacyTokens) {
    missing.push("WEBEX_APPLICATIONS_TOKEN");
  }

  if (missing.length) {
    throw new Error(
      `MOCK_DATA=false but missing required env: ${missing.join(", ")}`,
    );
  }
}
