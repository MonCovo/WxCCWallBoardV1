export type ChannelType = "telephony" | "chat" | "email" | "social" | "other";

export interface Kpis {
  offered: number;
  answered: number;
  abandoned: number;
  serviceLevelPct: number;
  asaSeconds: number;
  ahtSeconds: number;
}

export interface QueueRow {
  id: string;
  name: string;
  channel: ChannelType;
  inQueue: number;
  longestWaitSeconds: number;
  serviceLevelPct: number;
}

export type AgentAvailability =
  | "available"
  | "engaged"
  | "unavailable"
  | "wrapUp"
  | "loggedOut";

export interface AgentStateCounts {
  available: number;
  engaged: number;
  unavailable: number;
  wrapUp: number;
  loggedOut: number;
}

export interface AgentChannelStatus {
  channel: ChannelType;
  status: AgentAvailability;
  label: string;
}

export interface AgentRow {
  id: string;
  name: string;
  team: string;
  status: AgentAvailability;
  /** Epoch ms when the agent entered `status`. */
  stateSince?: number;
  channels: AgentChannelStatus[];
}

export interface ChannelMixItem {
  channel: ChannelType;
  count: number;
}

/** Cumulative KPI window currently driving offered/answered/abandoned/SL/ASA/AHT/channels. */
export interface StatsPeriod {
  from: number;
  to: number;
  timezone: string;
  resetAt: string;
  intervalHours: number;
  label: string;
}

export interface WallboardSnapshot {
  title: string;
  logoUrl: string;
  generatedAt: string;
  stale: boolean;
  error?: string;
  mock: boolean;
  period: StatsPeriod;
  kpis: Kpis;
  queues: QueueRow[];
  agentStates: AgentStateCounts;
  agents: AgentRow[];
  channels: ChannelMixItem[];
}

export interface HealthStatus {
  ok: boolean;
  mock: boolean;
  stale: boolean;
  lastSnapshotAt: string | null;
  tokenReady: boolean;
  error?: string;
}
