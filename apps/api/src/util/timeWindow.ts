import { config } from "../config.js";
import type { StatsPeriod } from "../types.js";

export type { StatsPeriod };

function parseResetAt(value: string): { hour: number; minute: number } {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return { hour: 0, minute: 0 };
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(date).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/** UTC epoch for a civil datetime in `timeZone` (handles DST with a short iterate). */
export function zonedDateTimeToEpoch(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number {
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = desired;
  for (let i = 0; i < 3; i++) {
    utc = desired - tzOffsetMs(new Date(utc), timeZone);
  }
  return utc;
}

export function zonedParts(
  now: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(now).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function formatHm(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(epochMs));
}

function lastResetClock(
  now: Date,
  timeZone: string,
  hour: number,
  minute: number,
): number {
  const p = zonedParts(now, timeZone);
  let t = zonedDateTimeToEpoch(p.year, p.month, p.day, hour, minute, 0, timeZone);
  if (t > now.getTime()) {
    const prior = zonedParts(new Date(t - 12 * 60 * 60 * 1000), timeZone);
    t = zonedDateTimeToEpoch(
      prior.year,
      prior.month,
      prior.day,
      hour,
      minute,
      0,
      timeZone,
    );
  }
  return t;
}

function periodLabel(
  from: number,
  intervalHours: number,
  resetAt: string,
  timeZone: string,
): string {
  if (intervalHours === 24 && resetAt === "00:00") return "Today";
  if (intervalHours === 24) return `Since ${formatHm(from, timeZone)}`;
  const until = from + intervalHours * 60 * 60 * 1000;
  return `${formatHm(from, timeZone)}–${formatHm(until, timeZone)}`;
}

/**
 * Cumulative KPI window: last aligned reset (`STATS_RESET_AT` in `ORG_TIMEZONE`)
 * plus `STATS_INTERVAL_HOURS` buckets. Default is midnight → now.
 */
export function statsPeriod(now = new Date()): StatsPeriod {
  const timezone = config.orgTimezone;
  const resetAt = config.statsResetAt;
  const intervalHours = config.statsIntervalHours;
  const { hour, minute } = parseResetAt(resetAt);
  const to = now.getTime();
  const origin = lastResetClock(now, timezone, hour, minute);
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const buckets = Math.floor(Math.max(0, to - origin) / intervalMs);
  const from = origin + buckets * intervalMs;
  return {
    from,
    to,
    timezone,
    resetAt,
    intervalHours,
    label: periodLabel(from, intervalHours, resetAt, timezone),
  };
}

/** Lookback for live agents/queues — must not reset with the KPI period. */
export function liveWindow(now = new Date()): { from: number; to: number } {
  const to = now.getTime();
  return { from: to - config.liveLookbackHours * 60 * 60 * 1000, to };
}

/** Epoch ms for start of "today" in the configured org timezone. */
export function startOfDayEpochMs(timezone: string, now = new Date()): number {
  const p = zonedParts(now, timezone);
  return zonedDateTimeToEpoch(p.year, p.month, p.day, 0, 0, 0, timezone);
}

export function queryWindow(
  timezone = config.orgTimezone,
  now = new Date(),
): { from: number; to: number } {
  if (timezone === config.orgTimezone) {
    const period = statsPeriod(now);
    return { from: period.from, to: period.to };
  }
  return { from: startOfDayEpochMs(timezone, now), to: now.getTime() };
}

export function emptyKpis() {
  return {
    offered: 0,
    answered: 0,
    abandoned: 0,
    serviceLevelPct: 0,
    asaSeconds: 0,
    ahtSeconds: 0,
  };
}
