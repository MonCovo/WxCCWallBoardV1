import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import type { WallboardSnapshot } from "./types";

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

function displayKeyParam(): string {
  const params = new URLSearchParams(window.location.search);
  const key = params.get("key");
  return key ? `?key=${encodeURIComponent(key)}` : "";
}

export function useSnapshot(pollMs = 5000) {
  const [snapshot, setSnapshot] = useState<WallboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    const id = setInterval(() => void tick(), pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return { snapshot, error };
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
const ROSTER_MIN_WIDTH = 240;
const ROSTER_REF_HEIGHT = 92;

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
    const heightScore = Math.min(cardH / 70, 1.15);
    const widthScore = Math.min(cardW / 320, 1.1);
    const score = heightScore * widthScore * cardW * cardH - unused * 400;
    if (score > best.score) best = { cols, cardW, cardH, score };
  }

  const scale = Math.max(0.55, Math.min(1, best.cardH / ROSTER_REF_HEIGHT));
  const density: RosterDensity =
    best.cardH >= 76 && best.cardW >= 280
      ? "full"
      : best.cardH >= 48 && best.cardW >= 200
        ? "compact"
        : "dense";
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
