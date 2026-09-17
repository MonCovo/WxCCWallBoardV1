/** Aggregation queries for wallboard KPIs (rolling start-of-day → now). */

export function taskKpiQuery(from: number, to: number): string {
  return `{
  taskDetails(
    from: ${from}
    to: ${to}
    aggregations: [
      { field: "id", type: count, name: "offered" }
      { field: "id", type: count, name: "answered", filters: { status: { equals: "handled" } } }
      { field: "id", type: count, name: "abandoned", filters: { isAbandoned: { equals: true } } }
      { field: "contactHandledWithinSla", type: count, name: "withinSla", filters: { contactHandledWithinSla: { equals: true } } }
      { field: "ringingDuration", type: avg, name: "asa" }
      { field: "connectedDuration", type: avg, name: "aht" }
    ]
  ) {
    aggregationResponse {
      name
      value
    }
  }
}`;
}

export function channelMixQuery(from: number, to: number): string {
  return `{
  taskDetails(
    from: ${from}
    to: ${to}
    aggregations: [
      { field: "id", type: count, name: "byChannel", groupBy: "channelType" }
    ]
  ) {
    aggregationResponse {
      name
      value
      key
    }
  }
}`;
}

export function queueStatsQuery(from: number, to: number): string {
  return `{
  taskDetails(
    from: ${from}
    to: ${to}
    filter: { isActive: { equals: true } }
    aggregations: [
      { field: "id", type: count, name: "inQueue", groupBy: "lastQueue.name" }
      { field: "totalDuration", type: max, name: "longestWait", groupBy: "lastQueue.name" }
    ]
  ) {
    aggregationResponse {
      name
      value
      key
    }
  }
}`;
}

export function agentStateQuery(from: number, to: number): string {
  return `{
  agentSession(
    from: ${from}
    to: ${to}
    filter: { isActive: { equals: true } }
    aggregations: [
      { field: "id", type: count, name: "byState", groupBy: "channelInfo.currentState" }
    ]
  ) {
    aggregationResponse {
      name
      value
      key
    }
  }
}`;
}
