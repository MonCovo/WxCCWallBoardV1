import { useEffect, useRef, useState } from "react";
import {
  clearQueueOverride,
  ensureQueueOverride,
  hasQueueOverride,
  METRIC_META,
  QUEUE_METRICS,
  resolveThreshold,
  setDefaultThreshold,
  setQueueOverride,
} from "./thresholds";
import type { MetricThreshold, QueueThresholdConfig } from "./types";

function parseBound(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function ThresholdInputs({
  value,
  unit,
  onChange,
}: {
  value: MetricThreshold;
  unit: string;
  onChange: (next: MetricThreshold) => void;
}) {
  return (
    <div className="threshold-inputs">
      <label className="threshold-field">
        <span>Warn</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="—"
          value={value.warn ?? ""}
          onChange={(e) =>
            onChange({ ...value, warn: parseBound(e.target.value) })
          }
        />
      </label>
      <label className="threshold-field">
        <span>Bad</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="—"
          value={value.bad ?? ""}
          onChange={(e) =>
            onChange({ ...value, bad: parseBound(e.target.value) })
          }
        />
      </label>
      <span className="threshold-unit">{unit}</span>
    </div>
  );
}

function MetricRows({
  config,
  queueId,
  onChange,
}: {
  config: QueueThresholdConfig;
  queueId?: string;
  onChange: (next: QueueThresholdConfig) => void;
}) {
  return (
    <table className="threshold-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Thresholds</th>
          {queueId ? <th /> : null}
        </tr>
      </thead>
      <tbody>
        {QUEUE_METRICS.map((metric) => {
          const meta = METRIC_META[metric];
          const overridden = queueId
            ? hasQueueOverride(config, queueId, metric)
            : false;
          const threshold = queueId
            ? resolveThreshold(config, queueId, metric)
            : config.defaults[metric];

          const updateMetric = (next: MetricThreshold) => {
            if (queueId) {
              // Typing into the fields creates an override from the resolved values.
              onChange(setQueueOverride(config, queueId, metric, next));
            } else {
              onChange(setDefaultThreshold(config, metric, next));
            }
          };

          return (
            <tr key={metric}>
              <td>
                <span className="threshold-metric-label">{meta.label}</span>
                {overridden ? (
                  <span className="threshold-override-tag">Override</span>
                ) : null}
              </td>
              <td>
                <ThresholdInputs
                  value={threshold}
                  unit={meta.unit}
                  onChange={updateMetric}
                />
              </td>
              {queueId ? (
                <td>
                  {overridden ? (
                    <button
                      type="button"
                      className="threshold-clear"
                      onClick={() =>
                        onChange(clearQueueOverride(config, queueId, metric))
                      }
                    >
                      Clear
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="threshold-clear"
                      onClick={() =>
                        onChange(ensureQueueOverride(config, queueId, metric))
                      }
                    >
                      Override
                    </button>
                  )}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ThresholdSettings({
  queues,
  config,
  onChange,
}: {
  queues: { id: string; name: string }[];
  config: QueueThresholdConfig;
  onChange: (next: QueueThresholdConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [queueId, setQueueId] = useState<string>("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (queueId && !queues.some((q) => q.id === queueId)) {
      setQueueId("");
    }
  }, [open, queueId, queues]);

  return (
    <div className="threshold-settings">
      <button
        type="button"
        className={`filter-toggle${open ? " active" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Queue threshold settings"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="filter-toggle-label">Thresholds</span>
      </button>
      {open ? (
        <div
          className="threshold-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="threshold-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Queue threshold alerts"
            ref={dialogRef}
          >
            <div className="threshold-dialog-head">
              <h3>Queue thresholds</h3>
              <button
                type="button"
                className="threshold-close"
                aria-label="Close threshold settings"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="threshold-help">
              Traffic-light alerts per metric. Leave blank to disable a band.
              SL% uses lower-is-worse; other metrics use higher-is-worse.
            </p>

            <section className="threshold-section">
              <h4>Global defaults</h4>
              <MetricRows config={config} onChange={onChange} />
            </section>

            <section className="threshold-section">
              <div className="threshold-section-head">
                <h4>Per-queue overrides</h4>
                <select
                  className="threshold-queue-select"
                  value={queueId}
                  onChange={(e) => setQueueId(e.target.value)}
                  aria-label="Queue for overrides"
                >
                  <option value="">Select queue…</option>
                  {queues.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}
                      {hasQueueOverride(config, q.id) ? " *" : ""}
                    </option>
                  ))}
                </select>
              </div>
              {queueId ? (
                <>
                  <MetricRows
                    config={config}
                    queueId={queueId}
                    onChange={onChange}
                  />
                  {hasQueueOverride(config, queueId) ? (
                    <button
                      type="button"
                      className="threshold-clear-all"
                      onClick={() =>
                        onChange(clearQueueOverride(config, queueId))
                      }
                    >
                      Clear all overrides for this queue
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="threshold-empty">
                  Pick a queue to set overrides on top of the defaults.
                </p>
              )}
            </section>

            <div className="threshold-dialog-foot">
              <button
                type="button"
                className="threshold-done"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
