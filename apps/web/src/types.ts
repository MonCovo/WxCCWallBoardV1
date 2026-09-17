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

export interface AgentStateCounts {
  available: number;
  engaged: number;
  unavailable: number;
  wrapUp: number;
  loggedOut: number;
}

export interface ChannelMixItem {
  channel: ChannelType;
  count: number;
}

export interface WallboardSnapshot {
  title: string;
  generatedAt: string;
  stale: boolean;
  error?: string;
  mock: boolean;
  kpis: Kpis;
  queues: QueueRow[];
  agentStates: AgentStateCounts;
  channels: ChannelMixItem[];
}
