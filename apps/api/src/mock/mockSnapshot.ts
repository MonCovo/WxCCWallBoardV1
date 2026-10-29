import type { WallboardSnapshot } from "../types.js";
import { config } from "../config.js";
import { statsPeriod } from "../util/timeWindow.js";

/** Deterministic-ish mock that wobbles slightly and grows through the stats period. */
export function buildMockSnapshot(): WallboardSnapshot {
  const period = statsPeriod();
  const tick = Math.floor(Date.now() / 15_000);
  const wobble = (n: number, amp: number) => n + ((tick * 7) % (amp * 2)) - amp;
  const span = Math.max(period.intervalHours * 60 * 60 * 1000, 1);
  const frac = Math.min(1, Math.max(0, (period.to - period.from) / span));
  const grow = (n: number, amp: number) => Math.max(0, Math.round(wobble(n, amp) * frac));

  return {
    title: config.wallboardTitle,
    logoUrl: config.wallboardLogoUrl,
    generatedAt: new Date().toISOString(),
    stale: false,
    mock: true,
    period,
    kpis: {
      offered: grow(248, 8),
      answered: grow(221, 6),
      abandoned: grow(27, 3),
      serviceLevelPct: Math.min(99, Math.max(70, wobble(86, 4))),
      asaSeconds: Math.max(5, wobble(28, 5)),
      ahtSeconds: Math.max(60, wobble(312, 20)),
    },
    queues: [
      {
        id: "q-sales",
        name: "Sales",
        channel: "telephony",
        offered: grow(86, 4),
        inQueue: Math.max(0, wobble(4, 2)),
        longestWaitSeconds: Math.max(0, wobble(95, 30)),
        serviceLevelPct: wobble(88, 5),
      },
      {
        id: "q-support",
        name: "Support",
        channel: "telephony",
        offered: grow(102, 5),
        inQueue: Math.max(0, wobble(7, 3)),
        longestWaitSeconds: Math.max(0, wobble(140, 40)),
        serviceLevelPct: wobble(79, 6),
      },
      {
        id: "q-chat",
        name: "Web Chat",
        channel: "chat",
        offered: grow(31, 3),
        inQueue: Math.max(0, wobble(3, 2)),
        longestWaitSeconds: Math.max(0, wobble(45, 15)),
        serviceLevelPct: wobble(92, 3),
      },
      {
        id: "q-email",
        name: "Email",
        channel: "email",
        offered: grow(18, 2),
        inQueue: Math.max(0, wobble(12, 4)),
        longestWaitSeconds: Math.max(0, wobble(1800, 200)),
        serviceLevelPct: wobble(74, 5),
      },
      {
        id: "q-whatsapp",
        name: "WhatsApp",
        channel: "social",
        offered: grow(11, 2),
        inQueue: Math.max(0, wobble(2, 2)),
        longestWaitSeconds: Math.max(0, wobble(90, 25)),
        serviceLevelPct: wobble(91, 4),
      },
    ],
    agents: [
      {
        id: "mock-alex",
        name: "Alex Rivera",
        team: "Sales",
        status: "engaged",
        stateSince: Date.now() - 187_000,
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
        stateSince: Date.now() - 742_000,
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
        stateSince: Date.now() - 46_000,
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
        stateSince: Date.now() - 512_000,
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
        stateSince: Date.now() - 93_000,
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
      { channel: "telephony", count: grow(160, 10) },
      { channel: "chat", count: grow(45, 5) },
      { channel: "email", count: grow(30, 4) },
      { channel: "social", count: grow(31, 4) },
    ],
  };
}
