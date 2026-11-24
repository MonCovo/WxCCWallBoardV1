import { useEffect, useId, useRef, useState } from "react";
import { Button, Option, Select } from "@momentum-design/components/react";
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

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), mdc-button, mdc-select';

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
        <span>Warning</span>
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
        <span>Error</span>
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
                    <Button
                      variant="tertiary"
                      size={24}
                      onClick={() =>
                        onChange(clearQueueOverride(config, queueId, metric))
                      }
                    >
                      Clear
                    </Button>
                  ) : (
                    <Button
                      variant="tertiary"
                      size={24}
                      onClick={() =>
                        onChange(ensureQueueOverride(config, queueId, metric))
                      }
                    >
                      Override
                    </Button>
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
  const titleId = useId();
  const descId = useId();
  const dialogId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.classList.add("dialog-open");

    const focusables = () =>
      dialog
        ? ([...dialog.querySelectorAll(FOCUSABLE)] as HTMLElement[])
        : [];

    const initial =
      focusables().find((el) => el.tagName === "INPUT" || el.tagName === "SELECT") ??
      focusables()[0];
    initial?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("dialog-open");
      const trigger = document.getElementById("wallboard-threshold-trigger") as
        | HTMLElement
        | null;
      (trigger ?? previouslyFocused)?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (queueId && !queues.some((q) => q.id === queueId)) {
      setQueueId("");
    }
  }, [open, queueId, queues]);

  return (
    <div className="threshold-settings">
      <Button
        id="wallboard-threshold-trigger"
        variant="secondary"
        size={28}
        onClick={() => setOpen(true)}
      >
        Thresholds
      </Button>
      {open ? (
        <div
          className="threshold-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            id={dialogId}
            className="threshold-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            ref={dialogRef}
          >
            <div className="threshold-dialog-head">
              <h3 id={titleId}>Queue thresholds</h3>
              <Button
                variant="tertiary"
                size={28}
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
            <p className="threshold-help" id={descId}>
              Success / warning / error bands per metric. Leave blank to
              disable a band. SL% uses lower-is-worse; other metrics use
              higher-is-worse.
            </p>

            <div className="threshold-dialog-body">
              <section className="threshold-section">
                <h4>Global defaults</h4>
                <MetricRows config={config} onChange={onChange} />
              </section>

              <section className="threshold-section">
                <div className="threshold-section-head">
                  <h4>Per-queue overrides</h4>
                  <Select
                    className="threshold-queue-select"
                    value={queueId}
                    data-aria-label="Queue for overrides"
                    placeholder="Select queue…"
                    onChange={(event) => {
                      const next = event.detail.value;
                      setQueueId(typeof next === "string" ? next : "");
                    }}
                  >
                    <Option value="" label="Select queue…" />
                    {queues.map((q) => (
                      <Option
                        key={q.id}
                        value={q.id}
                        label={`${q.name}${hasQueueOverride(config, q.id) ? " *" : ""}`}
                      />
                    ))}
                  </Select>
                </div>
                {queueId ? (
                  <>
                    <MetricRows
                      config={config}
                      queueId={queueId}
                      onChange={onChange}
                    />
                    {hasQueueOverride(config, queueId) ? (
                      <Button
                        variant="tertiary"
                        size={28}
                        onClick={() =>
                          onChange(clearQueueOverride(config, queueId))
                        }
                      >
                        Clear all overrides for this queue
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <p className="threshold-empty">
                    Pick a queue to set overrides on top of the defaults.
                  </p>
                )}
              </section>
            </div>

            <div className="threshold-dialog-foot">
              <Button
                variant="primary"
                size={32}
                onClick={() => setOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
