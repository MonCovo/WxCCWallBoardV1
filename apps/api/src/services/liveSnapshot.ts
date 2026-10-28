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
  channelType?: string;
  channelSubType?: string;
}

interface Aggregation {
  name?: string;
  value?: number | string;
}

interface TaskNode {
  channelType?: string;
  channelSubType?: string;
  lastQueue?: { name?: string; id?: string };
  aggregation?: Aggregation | Aggregation[];
}

interface ActivityNode {
  startTime?: number | string;
  endTime?: number | string;
  duration?: number | string;
  state?: string;
  isCurrentActivity?: boolean;
}

interface ChannelInfo {
  currentState?: string;
  channelType?: string;
  subChannelType?: string;
  idleCodeName?: string;
  lastActivityTime?: number | string;
  activities?: { nodes?: ActivityNode | ActivityNode[] };
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
      rows.push({
        name: a.name,
        value: a.value,
        key,
        channelType: task.channelType,
        channelSubType: task.channelSubType,
      });
    }
  }
  return rows;
}

function channelsOf(session: AgentNode): ChannelInfo[] {
  const info = session.channelInfo;
  if (!info) return [];
  return Array.isArray(info) ? info : [info];
}

function asList<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toEpochMs(value: unknown): number | undefined {
  const n = num(value);
  if (n <= 0) return undefined;
  return n < 1e12 ? n * 1000 : n;
}

function activityStartMs(node: ActivityNode): number | undefined {
  const start = toEpochMs(node.startTime);
  const end = toEpochMs(node.endTime);
  if (start && end) return Math.min(start, end);
  return start ?? end;
}

function channelStateSince(channel: ChannelInfo, nowMs: number): number | undefined {
  const nodes = asList(channel.activities?.nodes);
  const current =
    nodes.find((node) => node.isCurrentActivity) ??
    nodes.find((node) => !toEpochMs(node.endTime));
  if (current) {
    const start = activityStartMs(current);
    if (start) return start;
    const durationMs = num(current.duration);
    if (durationMs > 0) return nowMs - durationMs;
  }
  return toEpochMs(channel.lastActivityTime);
}

function statusSince(
  channels: Array<{ status: AgentAvailability; stateSince?: number }>,
  status: AgentAvailability,
): number | undefined {
  const times = channels
    .filter((channel) => channel.status === status)
    .map((channel) => channel.stateSince)
    .filter((value): value is number => typeof value === "number");
  if (times.length === 0) return undefined;
  return Math.min(...times);
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
  const nowMs = Date.now();
  const byId = new Map<
    string,
    {
      name: string;
      team: string;
      channels: Map<
        ChannelType,
        AgentChannelStatus & { stateSince?: number }
      >;
    }
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
      const type = mapChannel(channel.channelType, channel.subChannelType);
      const status = classifyChannelState(channel.currentState);
      const next: AgentChannelStatus & { stateSince?: number } = {
        channel: type,
        status,
        label: statusLabel(status, channel.currentState, channel.idleCodeName),
        stateSince: channelStateSince(channel, nowMs),
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
      const status = primaryState(channels.map((c) => c.status));
      return {
        id,
        name: row.name,
        team: row.team,
        status,
        stateSince: statusSince(channels, status),
        channels: channels.map(({ stateSince: _since, ...channel }) => channel),
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

function mapChannel(...parts: Array<string | undefined>): ChannelType {
  const c = parts
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .toLowerCase();
  if (!c) return "other";
  if (c.includes("email") || c.includes("mail")) return "email";
  if (c.includes("chat")) return "chat";
  if (
    c.includes("social") ||
    c.includes("whatsapp") ||
    c.includes("whats_app") ||
    c.includes("facebook") ||
    c.includes("messenger") ||
    c.includes("twitter") ||
    c.includes("sms") ||
    c.includes("apple")
  ) {
    return "social";
  }
  if (c.includes("tele") || c.includes("voice") || /(^|\s)phone(\s|$)/.test(c)) {
    return "telephony";
  }
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

function preferChannel(current: ChannelType, next: ChannelType): ChannelType {
  const rank: Record<ChannelType, number> = {
    social: 4,
    chat: 3,
    email: 2,
    telephony: 1,
    other: 0,
  };
  return rank[next] > rank[current] ? next : current;
}

function parseQueues(rows: AggRow[]): QueueRow[] {
  type Acc = {
    name: string;
    channel: ChannelType;
    inQueue: number;
    longestWaitSeconds: number;
  };
  const byName = new Map<string, Acc>();
  for (const row of rows) {
    const name = row.key || "Unknown";
    const channel = mapChannel(row.channelType, row.channelSubType, name);
    let acc = byName.get(name);
    if (!acc) {
      acc = { name, channel, inQueue: 0, longestWaitSeconds: 0 };
      byName.set(name, acc);
    } else {
      acc.channel = preferChannel(acc.channel, channel);
    }
    if (row.name === "inQueue") acc.inQueue += num(row.value);
    if (row.name === "longestWait") {
      acc.longestWaitSeconds = Math.max(
        acc.longestWaitSeconds,
        Math.round(num(row.value) / 1000),
      );
    }
  }
  return [...byName.values()].map((q) => ({
    id: q.name,
    name: q.name,
    channel: q.channel,
    inQueue: q.inQueue,
    longestWaitSeconds: q.longestWaitSeconds,
    serviceLevelPct: 0,
  }));
}

function parseChannels(rows: AggRow[]): ChannelMixItem[] {
  const byType = new Map<ChannelType, number>();
  for (const row of rows) {
    if (row.name !== "byChannel" && !row.key) continue;
    const channel = mapChannel(row.key, row.channelType, row.channelSubType);
    byType.set(channel, (byType.get(channel) ?? 0) + num(row.value));
  }
  return CHANNEL_ORDER.flatMap((channel) => {
    const count = byType.get(channel);
    return count ? [{ channel, count }] : [];
  });
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
