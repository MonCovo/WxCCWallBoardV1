import type { WallboardSnapshot } from "../types.js";
import { config } from "../config.js";

/** Deterministic-ish mock that wobbles slightly for demos. */
export function buildMockSnapshot(): WallboardSnapshot {
  const tick = Math.floor(Date.now() / 15_000);
  const wobble = (n: number, amp: number) => n + ((tick * 7) % (amp * 2)) - amp;

  return {
    title: config.wallboardTitle,
    logoUrl: config.wallboardLogoUrl,
    generatedAt: new Date().toISOString(),
    stale: false,
    mock: true,
    kpis: {
      offered: wobble(248, 8),
      answered: wobble(221, 6),
      abandoned: wobble(27, 3),
      serviceLevelPct: Math.min(99, Math.max(70, wobble(86, 4))),
      asaSeconds: Math.max(5, wobble(28, 5)),
      ahtSeconds: Math.max(60, wobble(312, 20)),
    },
    queues: [
      {
        id: "q-sales",
        name: "Sales",
        channel: "telephony",
        inQueue: Math.max(0, wobble(4, 2)),
        longestWaitSeconds: Math.max(0, wobble(95, 30)),
        serviceLevelPct: wobble(88, 5),
      },
      {
        id: "q-support",
        name: "Support",
        channel: "telephony",
        inQueue: Math.max(0, wobble(7, 3)),
        longestWaitSeconds: Math.max(0, wobble(140, 40)),
        serviceLevelPct: wobble(79, 6),
      },
      {
        id: "q-chat",
        name: "Web Chat",
        channel: "chat",
        inQueue: Math.max(0, wobble(3, 2)),
        longestWaitSeconds: Math.max(0, wobble(45, 15)),
        serviceLevelPct: wobble(92, 3),
      },
      {
        id: "q-email",
        name: "Email",
        channel: "email",
        inQueue: Math.max(0, wobble(12, 4)),
        longestWaitSeconds: Math.max(0, wobble(1800, 200)),
        serviceLevelPct: wobble(74, 5),
      },
    ],
    agents: [
      {
        id: "mock-alex",
        name: "Alex Rivera",
        team: "Sales",
        status: "engaged",
        channels: [
          { channel: "telephony", status: "engaged", label: "Connected" },
          { channel: "chat", status: "available", label: "Available" },
        ],
      },
      {
        id: "mock-jordan",
        name: "Jordan Lee",
        team: "Sales",
        status: "available",
        channels: [
          { channel: "telephony", status: "available", label: "Available" },
          { channel: "email", status: "available", label: "Available" },
        ],
      },
      {
        id: "mock-sam",
        name: "Sam Patel",
        team: "Support",
        status: "wrapUp",
        channels: [
          { channel: "telephony", status: "wrapUp", label: "Wrap-up" },
          { channel: "chat", status: "available", label: "Available" },
        ],
      },
      {
        id: "mock-riley",
        name: "Riley Chen",
        team: "Operations",
        status: "unavailable",
        channels: [
          { channel: "telephony", status: "unavailable", label: "Break" },
          { channel: "social", status: "unavailable", label: "Break" },
        ],
      },
      {
        id: "mock-casey",
        name: "Casey Nguyen",
        team: "Support",
        status: "engaged",
        channels: [
          { channel: "chat", status: "engaged", label: "Connected" },
          { channel: "email", status: "available", label: "Available" },
        ],
      },
    ],
    agentStates: {
      available: 1,
      engaged: 2,
      unavailable: 1,
      wrapUp: 1,
      loggedOut: 0,
    },
    channels: [
      { channel: "telephony", count: wobble(160, 10) },
      { channel: "chat", count: wobble(45, 5) },
      { channel: "email", count: wobble(30, 4) },
      { channel: "social", count: wobble(13, 3) },
    ],
  };
}
