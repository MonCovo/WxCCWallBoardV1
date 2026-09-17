import type { TokenManager } from "../auth/tokenManager.js";
import { config, assertLiveConfig } from "../config.js";
import { SearchClient } from "../graphql/searchClient.js";
import { buildMockSnapshot } from "../mock/mockSnapshot.js";
import type { HealthStatus, WallboardSnapshot } from "../types.js";
import { fetchLiveSnapshot } from "./liveSnapshot.js";

export class SnapshotService {
  private snapshot: WallboardSnapshot;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastError?: string;
  private readonly search: SearchClient | null;

  constructor(private readonly tokens: TokenManager) {
    this.search = config.mockData ? null : new SearchClient(tokens);
    this.snapshot = buildMockSnapshot();
    if (config.mockData) {
      this.snapshot.mock = true;
    } else {
      assertLiveConfig();
      this.snapshot = {
        ...buildMockSnapshot(),
        mock: false,
        stale: true,
        error: "Waiting for first live poll",
        kpis: {
          offered: 0,
          answered: 0,
          abandoned: 0,
          serviceLevelPct: 0,
          asaSeconds: 0,
          ahtSeconds: 0,
        },
        queues: [],
        agentStates: {
          available: 0,
          engaged: 0,
          unavailable: 0,
          wrapUp: 0,
          loggedOut: 0,
        },
        channels: [],
      };
    }
  }

  getSnapshot(): WallboardSnapshot {
    return this.snapshot;
  }

  getHealth(): HealthStatus {
    return {
      ok: !this.snapshot.stale || config.mockData,
      mock: config.mockData,
      stale: this.snapshot.stale,
      lastSnapshotAt: this.snapshot.generatedAt,
      tokenReady: config.mockData || this.tokens.ready,
      error: this.lastError,
    };
  }

  start(): void {
    void this.refresh();
    this.timer = setInterval(() => {
      void this.refresh();
    }, config.snapshotIntervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async refresh(): Promise<void> {
    if (config.mockData) {
      this.snapshot = buildMockSnapshot();
      this.lastError = undefined;
      return;
    }

    try {
      if (!this.search) throw new Error("Search client not initialized");
      const live = await fetchLiveSnapshot(this.search);
      this.snapshot = { ...live, stale: false, mock: false };
      this.lastError = undefined;
    } catch (err) {
      const message = (err as Error).message || "Unknown snapshot error";
      this.lastError = message;
      console.error("[snapshot]", message);
      this.snapshot = {
        ...this.snapshot,
        generatedAt: new Date().toISOString(),
        stale: true,
        mock: false,
        error: message,
      };
    }
  }
}
