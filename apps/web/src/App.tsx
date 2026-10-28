import { formatDuration, useClock, useFilterSelection, useNow, useSnapshot } from "./hooks";
import { applySelection, MultiSelectFilter } from "./MultiSelectFilter";
import type {
  AgentAvailability,
  AgentRow,
  AgentStateCounts,
  ChannelType,
  QueueRow,
  WallboardSnapshot,
} from "./types";

function slaClass(pct: number): string {
  if (pct >= 85) return "ok";
  if (pct >= 70) return "warn";
  return "bad";
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

function Header({ snapshot, clock }: { snapshot: WallboardSnapshot; clock: string }) {
  const tz = snapshot.period?.timezone;
  const updated = new Date(snapshot.generatedAt).toLocaleTimeString(undefined, {
    timeZone: tz,
  });
  const health = snapshot.stale ? "stale" : "live";
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
          </p>
        </div>
      </div>
      <div className="header-right">
        <span className={`badge ${health}`}>{snapshot.stale ? "STALE" : "LIVE"}</span>
        <time className="clock">{clock}</time>
      </div>
    </header>
  );
}

function KpiGrid({ snapshot }: { snapshot: WallboardSnapshot }) {
  const { kpis } = snapshot;
  const items = [
    { label: "Offered", value: String(kpis.offered) },
    { label: "Answered", value: String(kpis.answered) },
    { label: "Abandoned", value: String(kpis.abandoned) },
    {
      label: "Service Level",
      value: `${kpis.serviceLevelPct}%`,
      tone: slaClass(kpis.serviceLevelPct),
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
}: {
  queues: QueueRow[];
  selected: ReturnType<typeof useFilterSelection>[0];
  onChange: ReturnType<typeof useFilterSelection>[1];
}) {
  const options = queues.map((q) => ({ value: q.id, label: q.name }));
  const visible = applySelection(queues, selected, (q) => q.id);
  return (
    <section className="panel" aria-label="Queues">
      <div className="panel-head">
        <h2>Queues</h2>
        <MultiSelectFilter
          label="Queues"
          noun="queues"
          options={options}
          selected={selected}
          onChange={onChange}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>Queue</th>
            <th>Channel</th>
            <th>In queue</th>
            <th>Longest wait</th>
            <th>SL%</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty">
                {queues.length === 0 ? "No queue activity" : "No queues selected"}
              </td>
            </tr>
          ) : (
            visible.map((q) => (
              <tr key={q.id}>
                <td>{q.name}</td>
                <td>{channelLabel(q.channel)}</td>
                <td className={q.inQueue > 5 ? "warn" : ""}>{q.inQueue}</td>
                <td className={q.longestWaitSeconds > 120 ? "bad" : ""}>
                  {formatDuration(q.longestWaitSeconds)}
                </td>
                <td className={slaClass(q.serviceLevelPct)}>
                  {q.serviceLevelPct > 0 ? `${q.serviceLevelPct}%` : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function availabilityTone(status: AgentAvailability): string {
  switch (status) {
    case "available":
      return "ok";
    case "engaged":
      return "engaged";
    case "wrapUp":
    case "unavailable":
      return "warn";
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
  emptyLabel,
}: {
  agents: AgentRow[];
  emptyLabel: string;
}) {
  const now = useNow();
  if (agents.length === 0) {
    return <p className="empty-agents">{emptyLabel}</p>;
  }
  return (
    <ul className="agent-roster">
      {agents.map((agent) => {
        const elapsed =
          agent.stateSince != null
            ? Math.max(0, Math.floor((now - agent.stateSince) / 1000))
            : undefined;
        return (
        <li key={agent.id} className="agent-card">
          <div className="agent-card-head">
            <div className="agent-identity">
              <span className="agent-name-line">
                <span className="agent-name">{agent.name}</span>
                {elapsed != null ? (
                  <span className="agent-timer">{formatDuration(elapsed)}</span>
                ) : null}
              </span>
              <span className="agent-team">{agent.team}</span>
            </div>
            <span className={`agent-primary ${availabilityTone(agent.status)}`}>
              {availabilityLabel(agent.status)}
            </span>
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
                  {channelLabel(ch.channel)}
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
    { label: "Available", value: a.available, tone: "ok" },
    { label: "Engaged", value: a.engaged, tone: "engaged" },
    { label: "Wrap-up", value: a.wrapUp, tone: "warn" },
    { label: "Unavailable", value: a.unavailable, tone: "warn" },
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
        emptyLabel={agents.length === 0 ? "No agents signed in" : "No agents selected"}
      />
    </section>
  );
}

function ChannelMix({ snapshot }: { snapshot: WallboardSnapshot }) {
  const total = snapshot.channels.reduce((s, c) => s + c.count, 0) || 1;
  return (
    <section className="panel" aria-label="Channel mix">
      <h2>Channels</h2>
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
    </section>
  );
}

export function App() {
  const { snapshot, error } = useSnapshot(5000);
  const clock = useClock(snapshot?.period?.timezone);
  const [selectedTeams, setSelectedTeams] = useFilterSelection("wallboard.teams");
  const [selectedQueues, setSelectedQueues] = useFilterSelection("wallboard.queues");

  if (!snapshot) {
    return (
      <div className="boot">
        <p>{error ? `Cannot reach API: ${error}` : "Loading wallboard…"}</p>
      </div>
    );
  }

  return (
    <div className="wallboard">
      <Header snapshot={snapshot} clock={clock} />
      <KpiGrid snapshot={snapshot} />
      <div className="main-grid">
        <QueueTable
          queues={snapshot.queues}
          selected={selectedQueues}
          onChange={setSelectedQueues}
        />
        <div className="side-stack">
          <AgentStates
            agents={snapshot.agents ?? []}
            selected={selectedTeams}
            onChange={setSelectedTeams}
          />
          <ChannelMix snapshot={snapshot} />
        </div>
      </div>
    </div>
  );
}
