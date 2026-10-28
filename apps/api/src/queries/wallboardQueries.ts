/** Aggregation queries for wallboard KPIs (rolling start-of-day → now).
 * Search GraphQL: aggregations is [TaskV2Aggregation] / [AgentSessionV2Aggregation].
 * Group-by is done by selecting those fields under tasks / agentSessions, not a groupBy argument.
 */

export function taskKpiQuery(from: number, to: number): string {
  return `{
  taskDetails(
    from: ${from}
    to: ${to}
    aggregations: [
      { field: "id", type: count, name: "offered" }
      {
        field: "id"
        type: count
        name: "answered"
        filter: { isContactHandled: { equals: true } }
      }
      {
        field: "id"
        type: count
        name: "abandoned"
        filter: { abandonedType: { notequals: null } }
      }
      {
        field: "id"
        type: count
        name: "withinSla"
        filter: { isWithInServiceLevel: { equals: true } }
      }
      { field: "ringingDuration", type: average, name: "asa" }
      { field: "connectedDuration", type: average, name: "aht" }
    ]
  ) {
    tasks {
      aggregation {
        name
        value
      }
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
      { field: "id", type: count, name: "byChannel" }
    ]
  ) {
    tasks {
      channelType
      aggregation {
        name
        value
      }
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
      { field: "id", type: count, name: "inQueue" }
      { field: "lastQueue.duration", type: max, name: "longestWait" }
    ]
  ) {
    tasks {
      lastQueue {
        name
      }
      aggregation {
        name
        value
      }
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
      { field: "id", type: count, name: "byState" }
    ]
  ) {
    agentSessions {
      channelInfo {
        currentState
      }
      aggregation {
        name
        value
      }
    }
  }
}`;
}
