import { useRef, type CSSProperties, type ReactNode } from "react";
import {
  AlertChip,
  Spinner,
  ThemeProvider,
} from "@momentum-design/components/react";
import {
  formatDuration,
  useClock,
  useFilterSelection,
  useNow,
  useQueueThresholds,
  useRosterLayout,
  useSnapshot,
  useWallboardTheme,
  type FilterSelection,
} from "./hooks";
import { applySelection, MultiSelectFilter } from "./MultiSelectFilter";
import { ThemePicker } from "./ThemePicker";
import { ThresholdSettings } from "./ThresholdSettings";
import {
  toneClass,
  toneCueLabel,
  tonesForQueue,
  worstTone,
} from "./thresholds";
import type { WallboardThemeId } from "./themes";
import type {
  AgentAvailability,
  AgentRow,
  AgentStateCounts,
  AlertTone,
  ChannelType,
  QueueRow,
  QueueThresholdConfig,
  WallboardSnapshot,
} from "./types";
import { WallboardEmpty } from "./WallboardEmpty";

function slaClass(pct: number): AlertTone {
  if (pct >= 85) return "success";
  if (pct >= 70) return "warning";
  return "error";
}

function MetricCell({
  tone,
  children,
}: {
  tone: AlertTone;
  children: ReactNode;
}) {
  const cue = toneCueLabel(tone);
  return (
    <td className={`metric-cell ${toneClass(tone)}`.trim()}>
      <span className="metric-value">{children}</span>
      {cue ? (
        <span className="metric-cue" aria-label={cue === "Crit" ? "Critical" : "Warning"}>
          {cue}
        </span>
      ) : null}
    </td>
  );
}

function toServiceLevelPct(withinSla: number, answered: number): number {
  if (answered <= 0) return 0;
  return Math.min(100, Math.round((withinSla / answered) * 1000) / 10);
}

/** When queues are filtered, recompute SL from selected rows; "All" keeps org-wide KPI. */
function serviceLevelForSelection(
  queues: QueueRow[],
  selected: FilterSelection,
  fallbackPct: number,
): number {
  if (selected === null) return fallbackPct;
  const visible = applySelection(queues, selected, (q) => q.id);
  const answered = visible.reduce((sum, q) => sum + (q.answered ?? 0), 0);
  const withinSla = visible.reduce((sum, q) => sum + (q.withinSla ?? 0), 0);
  return toServiceLevelPct(withinSla, answered);
}

function channelLabel(c: ChannelType): string {
  switch (c) {
    case "telephony":
      return "Voice";
    case "chat":
      return "Chat";
    case "email":
      return "Email";
    case "social":
      return "Social";
    default:
      return "Other";
  }
}

function Header({
  snapshot,
  clock,
  paused,
  onToggleLive,
  themeId,
  onThemeChange,
}: {
  snapshot: WallboardSnapshot;
  clock: string;
  paused: boolean;
  onToggleLive: () => void;
  themeId: WallboardThemeId;
  onThemeChange: (next: WallboardThemeId) => void;
}) {
  const tz = snapshot.period?.timezone;
  const updated = new Date(snapshot.generatedAt).toLocaleTimeString(undefined, {
    timeZone: tz,
  });
  const label = paused ? "PAUSED" : snapshot.stale ? "STALE" : "LIVE";
  const chipVariant = paused
    ? "warning"
    : snapshot.stale
      ? "error"
      : "success";
  const period = snapshot.period?.label;
  return (
    <header className="header">
      <div className="header-brand">
        {snapshot.logoUrl ? (
          <img
            className="header-logo"
            src={snapshot.logoUrl}
            alt=""
            aria-hidden="true"
          />
        ) : null}
        <div>
          <h1>{snapshot.title}</h1>
          <p className="meta">
            Updated {updated}
            {period ? ` · ${period}` : ""}
            {snapshot.mock ? " · MOCK" : ""}
            {snapshot.error ? ` · ${snapshot.error}` : ""}
            {paused ? " · updates paused" : ""}
          </p>
        </div>
      </div>
      <div className="header-right">
        <div className="header-controls">
          <ThemePicker value={themeId} onChange={onThemeChange} />
          <AlertChip
            variant={chipVariant}
            label={label}
            onClick={onToggleLive}
            aria-pressed={paused}
            aria-label={paused ? "Resume live updates" : "Pause live updates"}
            title={paused ? "Resume live updates" : "Pause live updates"}
          />
          <time className="clock">{clock}</time>
        </div>
        {snapshot.watermark ? (
          <span className="watermark">{snapshot.watermark}</span>
        ) : null}
      </div>
    </header>
  );
}

function KpiGrid({
  snapshot,
  selectedQueues,
}: {
  snapshot: WallboardSnapshot;
  selectedQueues: FilterSelection;
}) {
  const { kpis } = snapshot;
  const serviceLevelPct = serviceLevelForSelection(
    snapshot.queues,
    selectedQueues,
    kpis.serviceLevelPct,
  );
  const items = [
    { label: "Offered", value: String(kpis.offered) },
    { label: "Answered", value: String(kpis.answered) },
    { label: "Abandoned", value: String(kpis.abandoned) },
    {
      label: "Service Level",
      value: `${serviceLevelPct}%`,
      tone: slaClass(serviceLevelPct),
    },
    { label: "ASA", value: formatDuration(kpis.asaSeconds) },
    { label: "AHT", value: formatDuration(kpis.ahtSeconds) },
  ];
  return (
    <section className="kpi-grid" aria-label="Key performance indicators">
      {items.map((item) => (
        <article key={item.label} className={`kpi ${item.tone ?? ""}`}>
          <span className="kpi-label">{item.label}</span>
          <span className="kpi-value">{item.value}</span>
        </article>
      ))}
    </section>
  );
}

function countAgentStates(agents: AgentRow[]): AgentStateCounts {
  const counts: AgentStateCounts = {
    available: 0,
    engaged: 0,
    unavailable: 0,
    wrapUp: 0,
    loggedOut: 0,
  };
  for (const agent of agents) counts[agent.status] += 1;
  return counts;
}

function QueueTable({
  queues,
  selected,
  onChange,
  thresholds,
  onThresholdsChange,
}: {
  queues: QueueRow[];
  selected: ReturnType<typeof useFilterSelection>[0];
  onChange: ReturnType<typeof useFilterSelection>[1];
  thresholds: QueueThresholdConfig;
  onThresholdsChange: (next: QueueThresholdConfig) => void;
}) {
  const options = queues.map((q) => ({ value: q.id, label: q.name }));
  const visible = applySelection(queues, selected, (q) => q.id);
  const tableDensity =
    visible.length > 14 ? "dense" : visible.length > 8 ? "compact" : "full";
  const empty =
    visible.length === 0 ? (
      queues.length === 0 ? (
        <WallboardEmpty
          className="queue-empty"
          size="medium"
          illustration="call-oneninetwo-empty-primary"
          heading="No queue activity"
          description="Queues will appear when contacts start arriving."
        />
      ) : (
        <WallboardEmpty
          className="queue-empty"
          size="medium"
          illustration="bullseye-filter-oneninetwo-empty-primary"
          heading="No queues selected"
          description="Adjust the Queues filter to show activity."
        />
      )
    ) : null;
  return (
    <section className="panel queue-panel" aria-label="Queues">
      <div className="panel-head">
        <h2>Queues</h2>
        <div className="panel-head-actions">
          <ThresholdSettings
            queues={queues.map((q) => ({ id: q.id, name: q.name }))}
            config={thresholds}
            onChange={onThresholdsChange}
          />
          <MultiSelectFilter
            label="Queues"
            noun="queues"
            options={options}
            selected={selected}
            onChange={onChange}
          />
        </div>
      </div>
      {empty ?? (
        <table className={`queue-table density-${tableDensity}`}>
          <thead>
            <tr>
              <th>Queue</th>
              <th>Channel</th>
              <th>Offered</th>
              <th>In queue</th>
              <th>Longest wait</th>
              <th>SL%</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((q) => {
              const tones = tonesForQueue(q, thresholds);
              const rowTone = worstTone(
                tones.offered,
                tones.inQueue,
                tones.longestWaitSeconds,
                tones.serviceLevelPct,
              );
              const rowAlert =
                rowTone === "warning" || rowTone === "error" ? rowTone : "";
              const rowClass = ["queue-row", rowAlert].filter(Boolean).join(" ");
              return (
                <tr key={q.id} className={rowClass}>
                  <td className="queue-name" title={q.name}>
                    {q.name}
                  </td>
                  <td>{channelLabel(q.channel)}</td>
                  <MetricCell tone={tones.offered}>{q.offered}</MetricCell>
                  <MetricCell tone={tones.inQueue}>{q.inQueue}</MetricCell>
                  <MetricCell tone={tones.longestWaitSeconds}>
                    {formatDuration(q.longestWaitSeconds)}
                  </MetricCell>
                  <MetricCell tone={tones.serviceLevelPct}>
                    {q.serviceLevelPct > 0 ? `${q.serviceLevelPct}%` : "—"}
                  </MetricCell>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function availabilityTone(status: AgentAvailability): string {
  switch (status) {
    case "available":
      return "success";
    case "engaged":
      return "engaged";
    case "wrapUp":
    case "unavailable":
      return "warning";
    default:
      return "";
  }
}

function availabilityLabel(status: AgentAvailability): string {
  switch (status) {
    case "available":
      return "Available";
    case "engaged":
      return "Engaged";
    case "wrapUp":
      return "Wrap-up";
    case "unavailable":
      return "Unavailable";
    case "loggedOut":
      return "Logged out";
  }
}

function AgentRoster({
  agents,
  emptyMode,
}: {
  agents: AgentRow[];
  emptyMode: "none" | "filtered";
}) {
  const now = useNow();
  const rosterRef = useRef<HTMLUListElement>(null);
  const layout = useRosterLayout(rosterRef, agents.length);
  if (agents.length === 0) {
    return emptyMode === "none" ? (
      <WallboardEmpty
        className="agent-empty"
        size="large"
        illustration="computer-headset-onetwozero-empty-primary"
        heading="No agents signed in"
        description="The roster will fill when agents become available."
      />
    ) : (
      <WallboardEmpty
        className="agent-empty"
        size="large"
        illustration="bullseye-filter-oneninetwo-empty-primary"
        heading="No agents selected"
        description="Adjust the Teams filter to show agents."
      />
    );
  }
  return (
    <ul
      ref={rosterRef}
      className={`agent-roster density-${layout.density}`}
      style={
        {
          "--agent-cols": String(layout.cols),
          "--agent-scale": String(layout.scale),
        } as CSSProperties
      }
    >
      {agents.map((agent) => {
        const elapsed =
          agent.stateSince != null
            ? Math.max(0, Math.floor((now - agent.stateSince) / 1000))
            : undefined;
        return (
        <li key={agent.id} className="agent-card">
          <div className="agent-card-head">
            <span className="agent-name" title={agent.name}>
              {agent.name}
            </span>
            <div className="agent-meta">
              {elapsed != null ? (
                <span className="agent-timer">{formatDuration(elapsed)}</span>
              ) : null}
              <span
                className="agent-status"
                title={availabilityLabel(agent.status)}
              >
                <span
                  className={`presence-dot ${availabilityTone(agent.status)}`}
                  aria-hidden="true"
                />
                <span className={`agent-primary ${availabilityTone(agent.status)}`}>
                  {availabilityLabel(agent.status)}
                </span>
              </span>
            </div>
            <span className="agent-team">{agent.team}</span>
          </div>
          <div className="agent-channels">
            {agent.channels.length === 0 ? (
              <span className="channel-pill">No channels</span>
            ) : (
              agent.channels.map((ch) => (
                <span
                  key={ch.channel}
                  className={`channel-pill ${availabilityTone(ch.status)}`}
                >
                  <span className={`channel-dot channel-${ch.channel}`} />
                  <span className="channel-name">{channelLabel(ch.channel)}</span>
                  <span className="channel-status">{ch.label}</span>
                </span>
              ))
            )}
          </div>
        </li>
        );
      })}
    </ul>
  );
}

function AgentStates({
  agents,
  selected,
  onChange,
}: {
  agents: AgentRow[];
  selected: ReturnType<typeof useFilterSelection>[0];
  onChange: ReturnType<typeof useFilterSelection>[1];
}) {
  const options = [...new Set(agents.map((a) => a.team).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((team) => ({ value: team, label: team }));
  const visible = applySelection(agents, selected, (a) => a.team);
  const a = countAgentStates(visible);
  const rows = [
    { label: "Available", value: a.available, tone: "success" },
    { label: "Engaged", value: a.engaged, tone: "engaged" },
    { label: "Wrap-up", value: a.wrapUp, tone: "warning" },
    { label: "Unavailable", value: a.unavailable, tone: "warning" },
  ];
  return (
    <section className="panel agent-panel" aria-label="Agent states">
      <div className="panel-head">
        <h2>Agents</h2>
        <MultiSelectFilter
          label="Teams"
          noun="teams"
          options={options}
          selected={selected}
          onChange={onChange}
        />
      </div>
      <div className="agent-grid">
        {rows.map((r) => (
          <div key={r.label} className={`agent-cell ${r.tone}`}>
            <span className="agent-value">{r.value}</span>
            <span className="agent-label">{r.label}</span>
          </div>
        ))}
      </div>
      <AgentRoster
        agents={visible}
        emptyMode={agents.length === 0 ? "none" : "filtered"}
      />
    </section>
  );
}

function ChannelMix({ snapshot }: { snapshot: WallboardSnapshot }) {
  const total = snapshot.channels.reduce((s, c) => s + c.count, 0) || 1;
  return (
    <section className="panel" aria-label="Channel mix">
      <h2>Channels</h2>
      {snapshot.channels.length === 0 ? (
        <WallboardEmpty
          className="channel-empty"
          size="medium"
          illustration="people-chat-threetwozero-empty-primary"
          heading="No channel volume"
          description="Channel mix appears once contacts are offered."
        />
      ) : (
        <ul className="channel-list">
          {snapshot.channels.map((c) => (
            <li key={c.channel}>
              <div className="channel-row">
                <span>{channelLabel(c.channel)}</span>
                <span>{c.count}</span>
              </div>
              <div className="bar-track">
                <div
                  className={`bar-fill channel-${c.channel}`}
                  style={{ width: `${(c.count / total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function App() {
  const { snapshot, error, paused, togglePaused } = useSnapshot(5000);
  const clock = useClock(snapshot?.period?.timezone);
  const [selectedTeams, setSelectedTeams] = useFilterSelection("wallboard.teams");
  const [selectedQueues, setSelectedQueues] = useFilterSelection("wallboard.queues");
  const [queueThresholds, setQueueThresholds] = useQueueThresholds(
    "wallboard.queueThresholds",
  );
  const [theme, setTheme] = useWallboardTheme("wallboard.theme");

  const body = !snapshot ? (
    <div className="boot">
      {error ? (
        <WallboardEmpty
          className="boot-empty"
          size="large"
          illustration="cloud-failure-oneninetwo-error"
          heading="Cannot reach API"
          description={error}
        />
      ) : (
        <div className="boot-loading">
          <Spinner size="large" aria-label="Loading wallboard" />
          <p>Loading wallboard…</p>
        </div>
      )}
    </div>
  ) : (
    <div className="wallboard">
      <Header
        snapshot={snapshot}
        clock={clock}
        paused={paused}
        onToggleLive={togglePaused}
        themeId={theme.id}
        onThemeChange={setTheme}
      />
      <KpiGrid snapshot={snapshot} selectedQueues={selectedQueues} />
      <div className="main-grid">
        <AgentStates
          agents={snapshot.agents ?? []}
          selected={selectedTeams}
          onChange={setSelectedTeams}
        />
        <div className="side-stack">
          <QueueTable
            queues={snapshot.queues}
            selected={selectedQueues}
            onChange={setSelectedQueues}
            thresholds={queueThresholds}
            onThresholdsChange={setQueueThresholds}
          />
          <ChannelMix snapshot={snapshot} />
        </div>
      </div>
    </div>
  );

  return (
    <ThemeProvider themeclass={theme.themeclass}>{body}</ThemeProvider>
  );
}
