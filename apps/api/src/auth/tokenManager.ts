import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokenStorePath = path.resolve(__dirname, "../data/tokens.json");

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Server-side Service App token manager.
 * Uses OAuth refresh_token grant; never exposes tokens to the browser.
 */
export class TokenManager {
  private accessToken: string;
  private refreshToken: string;
  private expiresAt: number;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    const stored = this.readStore();
    this.accessToken = stored?.accessToken || config.webex.accessToken;
    this.refreshToken = stored?.refreshToken || config.webex.refreshToken;
    // Unknown expiry from portal copy — refresh proactively after 12h or on 401
    this.expiresAt = stored?.expiresAt || Date.now() + 12 * 60 * 60 * 1000;
  }

  get ready(): boolean {
    return Boolean(this.accessToken || this.refreshToken);
  }

  async getAccessToken(): Promise<string> {
    if (!this.ready) {
      throw new Error("No Webex tokens configured");
    }
    const skewMs = 5 * 60 * 1000;
    if (this.accessToken && Date.now() < this.expiresAt - skewMs) {
      return this.accessToken;
    }
    return this.refresh();
  }

  async refresh(): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error("WEBEX_REFRESH_TOKEN is required to refresh access tokens");
    }
    if (!config.webex.clientId || !config.webex.clientSecret) {
      throw new Error("WEBEX_CLIENT_ID and WEBEX_CLIENT_SECRET are required");
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.webex.clientId,
      client_secret: config.webex.clientSecret,
      refresh_token: this.refreshToken,
    });

    const res = await fetch(config.webex.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token refresh failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    this.accessToken = data.access_token;
    if (data.refresh_token) this.refreshToken = data.refresh_token;
    const expiresInSec = data.expires_in ?? 14 * 24 * 60 * 60;
    this.expiresAt = Date.now() + expiresInSec * 1000;
    this.writeStore();
    return this.accessToken;
  }

  private readStore(): StoredTokens | null {
    try {
      if (!fs.existsSync(tokenStorePath)) return null;
      return JSON.parse(fs.readFileSync(tokenStorePath, "utf8")) as StoredTokens;
    } catch {
      return null;
    }
  }

  private writeStore(): void {
    try {
      const dir = path.dirname(tokenStorePath);
      fs.mkdirSync(dir, { recursive: true });
      const payload: StoredTokens = {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresAt: this.expiresAt,
      };
      fs.writeFileSync(tokenStorePath, JSON.stringify(payload, null, 2), {
        mode: 0o600,
      });
    } catch (err) {
      console.warn("[token] Could not persist rotated tokens:", (err as Error).message);
    }
  }
}
