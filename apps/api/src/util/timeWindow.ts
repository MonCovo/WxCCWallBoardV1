import { config } from "../config.js";

/** Epoch ms for start of "today" in the configured org timezone. */
export function startOfDayEpochMs(timezone: string, now = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "01";
    const y = Number(get("year"));
    const m = Number(get("month"));
    const d = Number(get("day"));
    // Approximate: build UTC noon then walk back — use iterative offset
    const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
    const asLocal = new Date(
      new Date(utcGuess).toLocaleString("en-US", { timeZone: timezone }),
    );
    const asUtc = new Date(new Date(utcGuess).toLocaleString("en-US", { timeZone: "UTC" }));
    const offset = asUtc.getTime() - asLocal.getTime();
    return utcGuess + offset;
  } catch {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return start.getTime();
  }
}

export function queryWindow(timezone = config.orgTimezone): { from: number; to: number } {
  const to = Date.now();
  const from = startOfDayEpochMs(timezone, new Date(to));
  return { from, to };
}
