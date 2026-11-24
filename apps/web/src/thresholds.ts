import type {
  AlertTone,
  MetricThreshold,
  QueueMetric,
  QueueRow,
  QueueThresholdConfig,
} from "./types";

export type MetricDirection = "higherIsWorse" | "lowerIsWorse";

export const QUEUE_METRICS: QueueMetric[] = [
  "offered",
  "inQueue",
  "longestWaitSeconds",
  "serviceLevelPct",
];

export const METRIC_META: Record<
  QueueMetric,
  { label: string; unit: string; direction: MetricDirection }
> = {
  offered: { label: "Offered", unit: "count", direction: "higherIsWorse" },
  inQueue: { label: "In queue", unit: "count", direction: "higherIsWorse" },
  longestWaitSeconds: {
    label: "Longest wait",
    unit: "seconds",
    direction: "higherIsWorse",
  },
  serviceLevelPct: { label: "SL%", unit: "%", direction: "lowerIsWorse" },
};

export const DEFAULT_QUEUE_THRESHOLDS: QueueThresholdConfig = {
  defaults: {
    offered: { warn: null, bad: null },
    inQueue: { warn: 5, bad: 10 },
    longestWaitSeconds: { warn: 60, bad: 120 },
    serviceLevelPct: { warn: 85, bad: 70 },
  },
  byQueue: {},
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseThreshold(raw: unknown): MetricThreshold | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const warn =
    obj.warn === null ? null : isFiniteNumber(obj.warn) ? obj.warn : undefined;
  const bad =
    obj.bad === null ? null : isFiniteNumber(obj.bad) ? obj.bad : undefined;
  if (warn === undefined || bad === undefined) return null;
  return { warn, bad };
}

export function normalizeQueueThresholdConfig(
  raw: unknown,
): QueueThresholdConfig {
  const base: QueueThresholdConfig = {
    defaults: {
      offered: { ...DEFAULT_QUEUE_THRESHOLDS.defaults.offered },
      inQueue: { ...DEFAULT_QUEUE_THRESHOLDS.defaults.inQueue },
      longestWaitSeconds: {
        ...DEFAULT_QUEUE_THRESHOLDS.defaults.longestWaitSeconds,
      },
      serviceLevelPct: { ...DEFAULT_QUEUE_THRESHOLDS.defaults.serviceLevelPct },
    },
    byQueue: {},
  };
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;

  if (obj.defaults && typeof obj.defaults === "object") {
    const defaults = obj.defaults as Record<string, unknown>;
    for (const metric of QUEUE_METRICS) {
      const parsed = parseThreshold(defaults[metric]);
      if (parsed) base.defaults[metric] = parsed;
    }
  }

  if (obj.byQueue && typeof obj.byQueue === "object") {
    const byQueue = obj.byQueue as Record<string, unknown>;
    for (const [queueId, overrides] of Object.entries(byQueue)) {
      if (!overrides || typeof overrides !== "object") continue;
      const sparse: Partial<Record<QueueMetric, MetricThreshold>> = {};
      for (const metric of QUEUE_METRICS) {
        const parsed = parseThreshold(
          (overrides as Record<string, unknown>)[metric],
        );
        if (parsed) sparse[metric] = parsed;
      }
      if (Object.keys(sparse).length > 0) base.byQueue[queueId] = sparse;
    }
  }

  return base;
}

export function resolveThreshold(
  config: QueueThresholdConfig,
  queueId: string,
  metric: QueueMetric,
): MetricThreshold {
  return config.byQueue[queueId]?.[metric] ?? config.defaults[metric];
}

export function toneForMetric(
  value: number,
  threshold: MetricThreshold,
  direction: MetricDirection,
): AlertTone {
  if (!Number.isFinite(value) || value <= 0) return "none";
  const { warn, bad } = threshold;
  if (warn == null && bad == null) return "none";

  if (direction === "higherIsWorse") {
    if (bad != null && value >= bad) return "error";
    if (warn != null && value >= warn) return "warning";
    return "success";
  }

  // lowerIsWorse (SL%)
  if (bad != null && value < bad) return "error";
  if (warn != null && value < warn) return "warning";
  return "success";
}

const TONE_RANK: Record<AlertTone, number> = {
  none: 0,
  success: 1,
  warning: 2,
  error: 3,
};

export function worstTone(...tones: AlertTone[]): AlertTone {
  let worst: AlertTone = "none";
  for (const tone of tones) {
    if (TONE_RANK[tone] > TONE_RANK[worst]) worst = tone;
  }
  return worst;
}

export function metricValue(queue: QueueRow, metric: QueueMetric): number {
  return queue[metric];
}

export function tonesForQueue(
  queue: QueueRow,
  config: QueueThresholdConfig,
): Record<QueueMetric, AlertTone> {
  const tones = {} as Record<QueueMetric, AlertTone>;
  for (const metric of QUEUE_METRICS) {
    tones[metric] = toneForMetric(
      metricValue(queue, metric),
      resolveThreshold(config, queue.id, metric),
      METRIC_META[metric].direction,
    );
  }
  return tones;
}

export function toneClass(tone: AlertTone): string {
  return tone === "none" ? "" : tone;
}

export function toneCueLabel(tone: AlertTone): string | null {
  if (tone === "warning") return "Warn";
  if (tone === "error") return "Crit";
  return null;
}

export function hasQueueOverride(
  config: QueueThresholdConfig,
  queueId: string,
  metric?: QueueMetric,
): boolean {
  const overrides = config.byQueue[queueId];
  if (!overrides) return false;
  if (metric) return overrides[metric] != null;
  return Object.keys(overrides).length > 0;
}

export function setDefaultThreshold(
  config: QueueThresholdConfig,
  metric: QueueMetric,
  threshold: MetricThreshold,
): QueueThresholdConfig {
  return {
    ...config,
    defaults: { ...config.defaults, [metric]: threshold },
  };
}

export function setQueueOverride(
  config: QueueThresholdConfig,
  queueId: string,
  metric: QueueMetric,
  threshold: MetricThreshold,
): QueueThresholdConfig {
  return {
    ...config,
    byQueue: {
      ...config.byQueue,
      [queueId]: {
        ...config.byQueue[queueId],
        [metric]: threshold,
      },
    },
  };
}

export function clearQueueOverride(
  config: QueueThresholdConfig,
  queueId: string,
  metric?: QueueMetric,
): QueueThresholdConfig {
  const existing = config.byQueue[queueId];
  if (!existing) return config;

  if (!metric) {
    const { [queueId]: _, ...rest } = config.byQueue;
    return { ...config, byQueue: rest };
  }

  const { [metric]: _, ...remaining } = existing;
  const byQueue = { ...config.byQueue };
  if (Object.keys(remaining).length === 0) delete byQueue[queueId];
  else byQueue[queueId] = remaining;
  return { ...config, byQueue };
}

export function ensureQueueOverride(
  config: QueueThresholdConfig,
  queueId: string,
  metric: QueueMetric,
): QueueThresholdConfig {
  if (hasQueueOverride(config, queueId, metric)) return config;
  return setQueueOverride(
    config,
    queueId,
    metric,
    { ...resolveThreshold(config, queueId, metric) },
  );
}
