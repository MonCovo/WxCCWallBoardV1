import { config } from "../config.js";
import type { SearchClient } from "../graphql/searchClient.js";
import {
  agentStateQuery,
  channelMixQuery,
  queueStatsQuery,
  taskKpiQuery,
} from "../queries/wallboardQueries.js";
import type {
  AgentAvailability,
  AgentChannelStatus,
  AgentRow,
  AgentStateCounts,
  ChannelMixItem,
  ChannelType,
  Kpis,
  QueueRow,
  WallboardSnapshot,
} from "../types.js";
import { liveWindow, statsPeriod } from "../util/timeWindow.js";

interface AggRow {
  name?: string;
  value?: number | string;
  key?: string;
}

interface Aggregation {
  name?: string;
  value?: number | string;
}

interface TaskNode {
  channelType?: string;
  lastQueue?: { name?: string; id?: string };
  aggregation?: Aggregation | Aggregation[];
}

interface ChannelInfo {
  currentState?: string;
  channelType?: string;
  idleCodeName?: string;
}

interface AgentNode {
  agentId?: string;
  agentName?: string;
  teamName?: string;
  channelInfo?: ChannelInfo | ChannelInfo[];
}

interface PageInfo {
  hasNextPage?: boolean;
  endCursor?: string | null;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function aggList(node: { aggregation?: Aggregation | Aggregation[] }): Aggregation[] {
  const a = node.aggregation;
  if (!a) return [];
  return Array.isArray(a) ? a : [a];
}

function flattenTaskAggs(
  tasks: TaskNode[] | undefined,
  keyOf: (t: TaskNode) => string | undefined,
): AggRow[] {
  const rows: AggRow[] = [];
  for (const task of tasks ?? []) {
    const key = keyOf(task);
    for (const a of aggList(task)) {
      rows.push({ name: a.name, value: a.value, key });
    }
  }
  return rows;
}

function channelsOf(session: AgentNode): ChannelInfo[] {
  const info = session.channelInfo;
  if (!info) return [];
  return Array.isArray(info) ? info : [info];
}

const CHANNEL_ORDER: ChannelType[] = [
  "telephony",
  "chat",
  "email",
  "social",
  "other",
];

const STATE_PRIORITY: Record<AgentAvailability, number> = {
  engaged: 4,
  wrapUp: 3,
  available: 2,
  unavailable: 1,
  loggedOut: 0,
};

function classifyChannelState(raw: string | undefined): AgentAvailability {
  const key = (raw || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return "unavailable";
  if (
    key.includes("connected") ||
    key.includes("consult") ||
    key.includes("conference") ||
    key.includes("ringing") ||
    key.includes("reserved")
  ) {
    return "engaged";
  }
  if (key.includes("wrap")) return "wrapUp";
  if (
    key.includes("idle") ||
    key.includes("not_ready") ||
    key.includes("notready") ||
    key.includes("unavailable")
  ) {
    return "unavailable";
  }
  if (key.includes("avail") || key === "ready") return "available";
  if (key.includes("logout") || key.includes("logged_out") || key === "loggedout") {
    return "loggedOut";
  }
  return "unavailable";
}

function primaryState(states: AgentAvailability[]): AgentAvailability {
  if (states.length === 0) return "unavailable";
  return states.reduce((best, state) =>
    STATE_PRIORITY[state] > STATE_PRIORITY[best] ? state : best,
  );
}

function statusLabel(
  bucket: AgentAvailability,
  raw: string | undefined,
  idleCode: string | undefined,
): string {
  const code = idleCode?.trim();
  if (bucket === "unavailable" && code) return code;
  const key = (raw || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (key.includes("ringing")) return "Ringing";
  if (key.includes("consult")) return "Consulting";
  if (key.includes("conference")) return "Conference";
  if (key.includes("reserved")) return "Reserved";
  if (key.includes("connected")) return "Connected";
  if (key.includes("wrap")) return "Wrap-up";
  if (key.includes("idle")) return code || "Idle";
  if (key.includes("avail")) return "Available";
  if (bucket === "available") return "Available";
  if (bucket === "engaged") return "Connected";
  if (bucket === "wrapUp") return "Wrap-up";
  if (bucket === "loggedOut") return "Logged out";
  return "Unavailable";
}

function emptyAgentCounts(): AgentStateCounts {
  return {
    available: 0,
    engaged: 0,
    unavailable: 0,
    wrapUp: 0,
    loggedOut: 0,
  };
}

const UNASSIGNED_TEAM = "Unassigned";

function mapAgents(sessions: AgentNode[] | undefined): AgentRow[] {
  const byId = new Map<
    string,
    { name: string; team: string; channels: Map<ChannelType, AgentChannelStatus> }
  >();

  (sessions ?? []).forEach((session, index) => {
    const id = session.agentId || `__row_${index}`;
    const team = session.teamName?.trim() || UNASSIGNED_TEAM;
    let row = byId.get(id);
    if (!row) {
      row = {
        name: session.agentName?.trim() || "Unknown agent",
        team,
        channels: new Map(),
      };
      byId.set(id, row);
    } else {
      if (session.agentName?.trim() && row.name === "Unknown agent") {
        row.name = session.agentName.trim();
      }
      if (row.team === UNASSIGNED_TEAM && team !== UNASSIGNED_TEAM) {
        row.team = team;
      }
    }

    for (const channel of channelsOf(session)) {
      const type = mapChannel(channel.channelType);
      const status = classifyChannelState(channel.currentState);
      const next: AgentChannelStatus = {
        channel: type,
        status,
        label: statusLabel(status, channel.currentState, channel.idleCodeName),
      };
      const prev = row.channels.get(type);
      if (!prev || STATE_PRIORITY[status] > STATE_PRIORITY[prev.status]) {
        row.channels.set(type, next);
      }
    }
  });

  return [...byId.entries()]
    .map(([id, row]) => {
      const channels = CHANNEL_ORDER.flatMap((type) => {
        const channel = row.channels.get(type);
        return channel ? [channel] : [];
      });
      return {
        id,
        name: row.name,
        team: row.team,
        status: primaryState(channels.map((c) => c.status)),
        channels,
      };
    })
    .sort((a, b) => {
      const byStatus = STATE_PRIORITY[b.status] - STATE_PRIORITY[a.status];
      if (byStatus !== 0) return byStatus;
      return a.name.localeCompare(b.name);
    });
}

function mapAgentStates(agents: AgentRow[]): AgentStateCounts {
  const counts = emptyAgentCounts();
  for (const agent of agents) counts[agent.status] += 1;
  return counts;
}

const AGENT_PAGE_CAP = 20;

async function fetchActiveAgentSessions(
  client: SearchClient,
  from: number,
  to: number,
): Promise<AgentNode[]> {
  const sessions: AgentNode[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < AGENT_PAGE_CAP; page++) {
    const data = await client.query<{
      agentSession: { agentSessions?: AgentNode[]; pageInfo?: PageInfo };
    }>(agentStateQuery(from, to, cursor));
    sessions.push(...(data.agentSession?.agentSessions ?? []));
    const info = data.agentSession?.pageInfo;
    if (!info?.hasNextPage || !info.endCursor) break;
    cursor = info.endCursor;
  }
  return sessions;
}

function mapChannel(raw: string | undefined): ChannelType {
  const c = (raw || "").toLowerCase();
  if (c.includes("tele") || c.includes("voice") || c === "phone") return "telephony";
  if (c.includes("chat")) return "chat";
  if (c.includes("email") || c.includes("mail")) return "email";
  if (c.includes("social")) return "social";
  return "other";
}

function parseKpis(rows: AggRow[]): Kpis {
  const byName = Object.fromEntries(
    rows.filter((r) => r.name).map((r) => [r.name!, num(r.value)]),
  );
  const offered = byName.offered ?? 0;
  const answered = byName.answered ?? 0;
  const abandoned = byName.abandoned ?? 0;
  const withinSla = byName.withinSla ?? 0;
  const serviceLevelPct =
    answered > 0 ? Math.round((withinSla / answered) * 1000) / 10 : 0;
  // durations from Search are typically ms
  const asaSeconds = Math.round(num(byName.asa) / 1000);
  const ahtSeconds = Math.round(num(byName.aht) / 1000);
  return {
    offered,
    answered,
    abandoned,
    serviceLevelPct,
    asaSeconds,
    ahtSeconds,
  };
}

function parseQueues(rows: AggRow[]): QueueRow[] {
  const inQueue = new Map<string, number>();
  const longest = new Map<string, number>();
  for (const row of rows) {
    const name = row.key || "Unknown";
    if (row.name === "inQueue") inQueue.set(name, num(row.value));
    if (row.name === "longestWait") {
      longest.set(name, Math.round(num(row.value) / 1000));
    }
  }
  const names = new Set([...inQueue.keys(), ...longest.keys()]);
  return [...names].map((name) => ({
    id: name,
    name,
    channel: "telephony" as ChannelType,
    inQueue: inQueue.get(name) ?? 0,
    longestWaitSeconds: longest.get(name) ?? 0,
    serviceLevelPct: 0,
  }));
}

function parseChannels(rows: AggRow[]): ChannelMixItem[] {
  return rows
    .filter((r) => r.name === "byChannel" || r.key)
    .map((r) => ({
      channel: mapChannel(r.key),
      count: num(r.value),
    }));
}

/**
 * Fetch live Search aggregations and normalize into a wallboard snapshot.
 * Field names may vary by tenant schema; failures bubble to SnapshotService.
 */
export async function fetchLiveSnapshot(
  client: SearchClient,
): Promise<Omit<WallboardSnapshot, "stale" | "error" | "mock">> {
  const period = statsPeriod();
  const live = liveWindow();

  const [kpiData, channelData, queueData, agentSessions] = await Promise.all([
    client.query<{ taskDetails: { tasks?: TaskNode[] } }>(
      taskKpiQuery(period.from, period.to),
    ),
    client.query<{ taskDetails: { tasks?: TaskNode[] } }>(
      channelMixQuery(period.from, period.to),
    ),
    client.query<{ taskDetails: { tasks?: TaskNode[] } }>(
      queueStatsQuery(live.from, live.to),
    ),
    fetchActiveAgentSessions(client, live.from, live.to),
  ]);

  const agents = mapAgents(agentSessions);

  return {
    title: config.wallboardTitle,
    logoUrl: config.wallboardLogoUrl,
    generatedAt: new Date().toISOString(),
    period,
    kpis: parseKpis(flattenTaskAggs(kpiData.taskDetails?.tasks, () => undefined)),
    queues: parseQueues(
      flattenTaskAggs(queueData.taskDetails?.tasks, (t) => t.lastQueue?.name),
    ),
    agents,
    agentStates: mapAgentStates(agents),
    channels: parseChannels(
      flattenTaskAggs(channelData.taskDetails?.tasks, (t) => t.channelType),
    ),
  };
}
