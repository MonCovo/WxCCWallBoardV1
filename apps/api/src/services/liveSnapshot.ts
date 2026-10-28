import { config } from "../config.js";
import type { SearchClient } from "../graphql/searchClient.js";
import {
  agentStateQuery,
  channelMixQuery,
  queueStatsQuery,
  taskKpiQuery,
} from "../queries/wallboardQueries.js";
import type {
  AgentStateCounts,
  ChannelMixItem,
  ChannelType,
  Kpis,
  QueueRow,
  WallboardSnapshot,
} from "../types.js";
import { queryWindow } from "../util/timeWindow.js";

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

interface AgentNode {
  channelInfo?: { currentState?: string };
  aggregation?: Aggregation | Aggregation[];
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

function flattenAgentAggs(sessions: AgentNode[] | undefined): AggRow[] {
  const rows: AggRow[] = [];
  for (const session of sessions ?? []) {
    const key = session.channelInfo?.currentState;
    for (const a of aggList(session)) {
      rows.push({ name: a.name, value: a.value, key });
    }
  }
  return rows;
}

function mapChannel(raw: string | undefined): ChannelType {
  const c = (raw || "").toLowerCase();
  if (c.includes("tele") || c.includes("voice") || c === "phone") return "telephony";
  if (c.includes("chat")) return "chat";
  if (c.includes("email") || c.includes("mail")) return "email";
  if (c.includes("social")) return "social";
  return "other";
}

function mapAgentStates(rows: AggRow[]): AgentStateCounts {
  const counts: AgentStateCounts = {
    available: 0,
    engaged: 0,
    unavailable: 0,
    wrapUp: 0,
    loggedOut: 0,
  };
  for (const row of rows) {
    const key = (row.key || "").toLowerCase();
    const value = num(row.value);
    if (key.includes("avail") || key.includes("idle") || key.includes("ready")) {
      counts.available += value;
    } else if (
      key.includes("engag") ||
      key.includes("talk") ||
      key.includes("connected") ||
      key.includes("busy")
    ) {
      counts.engaged += value;
    } else if (key.includes("wrap") || key.includes("acw")) {
      counts.wrapUp += value;
    } else if (key.includes("logout") || key.includes("logged")) {
      counts.loggedOut += value;
    } else {
      counts.unavailable += value;
    }
  }
  return counts;
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
  const { from, to } = queryWindow();

  const [kpiData, channelData, queueData, agentData] = await Promise.all([
    client.query<{ taskDetails: { tasks?: TaskNode[] } }>(taskKpiQuery(from, to)),
    client.query<{ taskDetails: { tasks?: TaskNode[] } }>(
      channelMixQuery(from, to),
    ),
    client.query<{ taskDetails: { tasks?: TaskNode[] } }>(
      queueStatsQuery(from, to),
    ),
    client.query<{ agentSession: { agentSessions?: AgentNode[] } }>(
      agentStateQuery(from, to),
    ),
  ]);

  return {
    title: config.wallboardTitle,
    generatedAt: new Date().toISOString(),
    kpis: parseKpis(flattenTaskAggs(kpiData.taskDetails?.tasks, () => undefined)),
    queues: parseQueues(
      flattenTaskAggs(queueData.taskDetails?.tasks, (t) => t.lastQueue?.name),
    ),
    agentStates: mapAgentStates(
      flattenAgentAggs(agentData.agentSession?.agentSessions),
    ),
    channels: parseChannels(
      flattenTaskAggs(channelData.taskDetails?.tasks, (t) => t.channelType),
    ),
  };
}
