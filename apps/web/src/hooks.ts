import { useCallback, useEffect, useState } from "react";
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

export function useClock(timeZone?: string): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString(undefined, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
