import { formatDuration, useClock, useSnapshot } from "./hooks";
import type { ChannelType, QueueRow, WallboardSnapshot } from "./types";

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
  const updated = new Date(snapshot.generatedAt).toLocaleTimeString();
  const health = snapshot.stale ? "stale" : "live";
  return (
    <header className="header">
      <div>
        <h1>{snapshot.title}</h1>
        <p className="meta">
          Updated {updated}
          {snapshot.mock ? " · MOCK" : ""}
          {snapshot.error ? ` · ${snapshot.error}` : ""}
        </p>
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

function QueueTable({ queues }: { queues: QueueRow[] }) {
  return (
    <section className="panel" aria-label="Queues">
      <h2>Queues</h2>
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
          {queues.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty">
                No queue activity
              </td>
            </tr>
          ) : (
            queues.map((q) => (
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

function AgentStates({ snapshot }: { snapshot: WallboardSnapshot }) {
  const a = snapshot.agentStates;
  const rows = [
    { label: "Available", value: a.available, tone: "ok" },
    { label: "Engaged", value: a.engaged, tone: "" },
    { label: "Wrap-up", value: a.wrapUp, tone: "warn" },
    { label: "Unavailable", value: a.unavailable, tone: "warn" },
    { label: "Logged out", value: a.loggedOut, tone: "" },
  ];
  return (
    <section className="panel" aria-label="Agent states">
      <h2>Agents</h2>
      <div className="agent-grid">
        {rows.map((r) => (
          <div key={r.label} className={`agent-cell ${r.tone}`}>
            <span className="agent-value">{r.value}</span>
            <span className="agent-label">{r.label}</span>
          </div>
        ))}
      </div>
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
  const clock = useClock();

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
        <QueueTable queues={snapshot.queues} />
        <div className="side-stack">
          <AgentStates snapshot={snapshot} />
          <ChannelMix snapshot={snapshot} />
        </div>
      </div>
    </div>
  );
}
