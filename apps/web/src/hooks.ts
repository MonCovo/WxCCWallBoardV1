import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import {
  DEFAULT_QUEUE_THRESHOLDS,
  normalizeQueueThresholdConfig,
} from "./thresholds";
import {
  DEFAULT_THEME_ID,
  resolveTheme,
  type WallboardTheme,
  type WallboardThemeId,
} from "./themes";
import type { QueueThresholdConfig, WallboardSnapshot } from "./types";

/** null means show all items; an array is an explicit multi-select (may be empty). */
export type FilterSelection = string[] | null;

function readFilterSelection(key: string): FilterSelection {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw === "*") return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return null;
  }
}

export function useFilterSelection(storageKey: string) {
  const [selected, setSelected] = useState<FilterSelection>(() =>
    readFilterSelection(storageKey),
  );

  const update = useCallback(
    (next: FilterSelection) => {
      setSelected(next);
      try {
        if (next === null) localStorage.setItem(storageKey, "*");
        else localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* private mode / quota — keep in-memory selection */
      }
    },
    [storageKey],
  );

  return [selected, update] as const;
}

function readQueueThresholds(key: string): QueueThresholdConfig {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(DEFAULT_QUEUE_THRESHOLDS);
    return normalizeQueueThresholdConfig(JSON.parse(raw) as unknown);
  } catch {
    return structuredClone(DEFAULT_QUEUE_THRESHOLDS);
  }
}

export function useQueueThresholds(storageKey = "wallboard.queueThresholds") {
  const [config, setConfig] = useState<QueueThresholdConfig>(() =>
    readQueueThresholds(storageKey),
  );

  const update = useCallback(
    (next: QueueThresholdConfig) => {
      const normalized = normalizeQueueThresholdConfig(next);
      setConfig(normalized);
      try {
        localStorage.setItem(storageKey, JSON.stringify(normalized));
      } catch {
        /* private mode / quota — keep in-memory config */
      }
    },
    [storageKey],
  );

  return [config, update] as const;
}

function readThemeId(key: string): WallboardThemeId {
  try {
    const raw = localStorage.getItem(key);
    return resolveTheme(raw).id;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function useWallboardTheme(storageKey = "wallboard.theme") {
  const [themeId, setThemeId] = useState<WallboardThemeId>(() =>
    readThemeId(storageKey),
  );

  const theme: WallboardTheme = resolveTheme(themeId);

  const setTheme = useCallback(
    (next: WallboardThemeId) => {
      const resolved = resolveTheme(next);
      setThemeId(resolved.id);
      try {
        localStorage.setItem(storageKey, resolved.id);
      } catch {
        /* private mode / quota — keep in-memory theme */
      }
    },
    [storageKey],
  );

  return [theme, setTheme] as const;
}

function displayKeyParam(): string {
  const params = new URLSearchParams(window.location.search);
  const key = params.get("key");
  return key ? `?key=${encodeURIComponent(key)}` : "";
}

export function useSnapshot(pollMs = 5000) {
  const [snapshot, setSnapshot] = useState<WallboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/snapshot${displayKeyParam()}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as WallboardSnapshot;
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError((err as Error).name === "TimeoutError" ? "Snapshot timed out" : (err as Error).message);
    }
  }, []);

  useEffect(() => {
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        await load();
      } finally {
        busy = false;
      }
    };
    void tick();
    if (paused) return;
    const id = setInterval(() => void tick(), pollMs);
    return () => clearInterval(id);
  }, [load, pollMs, paused]);

  const togglePaused = useCallback(() => {
    setPaused((prev) => {
      const next = !prev;
      // Resuming: refresh immediately so the board is current.
      if (prev) void load();
      return next;
    });
  }, [load]);

  return { snapshot, error, paused, togglePaused };
}

export function useNow(tickMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}

export function useClock(timeZone?: string): string {
  const now = useNow();
  return new Date(now).toLocaleTimeString(undefined, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export type RosterDensity = "full" | "compact" | "dense";

export interface RosterLayout {
  cols: number;
  scale: number;
  density: RosterDensity;
}

const ROSTER_GAP = 8;
/** Allow slightly narrower cards so height-starved rosters can gain a column. */
const ROSTER_MIN_WIDTH = 200;
/** Min card height to show labeled channel pills without clipping. */
const FULL_MIN_HEIGHT = 104;
/** Min card height for status dots (no channel labels). */
const COMPACT_MIN_HEIGHT = 56;
const FULL_REF_HEIGHT = 112;
const COMPACT_REF_HEIGHT = 64;
const DENSE_REF_HEIGHT = 40;

function densityFor(cardW: number, cardH: number): RosterDensity {
  if (cardH >= FULL_MIN_HEIGHT && cardW >= 260) return "full";
  if (cardH >= COMPACT_MIN_HEIGHT && cardW >= 160) return "compact";
  return "dense";
}

function refHeightFor(density: RosterDensity): number {
  switch (density) {
    case "full":
      return FULL_REF_HEIGHT;
    case "compact":
      return COMPACT_REF_HEIGHT;
    case "dense":
      return DENSE_REF_HEIGHT;
  }
}

export function computeRosterLayout(
  count: number,
  width: number,
  height: number,
): RosterLayout {
  if (count <= 0 || width <= 0 || height <= 0) {
    return { cols: 1, scale: 1, density: "full" };
  }

  let best = { cols: 1, cardW: width, cardH: 0, score: -Infinity };
  const maxCols = Math.min(
    count,
    Math.max(1, Math.floor((width + ROSTER_GAP) / (ROSTER_MIN_WIDTH + ROSTER_GAP))),
  );

  for (let cols = 1; cols <= maxCols; cols++) {
    const rows = Math.ceil(count / cols);
    const cardW = (width - ROSTER_GAP * (cols - 1)) / cols;
    const cardH = (height - ROSTER_GAP * (rows - 1)) / rows;
    if (cardW < 1 || cardH < 1) continue;
    const unused = cols * rows - count;
    const density = densityFor(cardW, cardH);
    // Prefer layouts that keep labeled channels readable; then maximize card area.
    const densityBonus =
      density === "full" ? 1.35 : density === "compact" ? 1.1 : 0.85;
    const heightScore = Math.min(cardH / FULL_MIN_HEIGHT, 1.2);
    const widthScore = Math.min(cardW / 300, 1.1);
    const score =
      heightScore * widthScore * cardW * cardH * densityBonus - unused * 400;
    if (score > best.score) best = { cols, cardW, cardH, score };
  }

  const density = densityFor(best.cardW, best.cardH);
  const scale = Math.max(
    0.55,
    Math.min(1, best.cardH / refHeightFor(density)),
  );
  return { cols: best.cols, scale, density };
}

export function useRosterLayout(
  ref: RefObject<HTMLElement | null>,
  count: number,
): RosterLayout {
  const [layout, setLayout] = useState<RosterLayout>({
    cols: 1,
    scale: 1,
    density: "full",
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      setLayout(computeRosterLayout(count, el.clientWidth, el.clientHeight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [count, ref]);

  return layout;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
