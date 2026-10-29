/** Aggregation queries for wallboard KPIs (configurable stats period → now).
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
      channelSubType
      aggregation {
        name
        value
      }
    }
  }
}`;
}

export function queueTotalsQuery(from: number, to: number): string {
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
        name: "withinSla"
        filter: { isWithInServiceLevel: { equals: true } }
      }
    ]
  ) {
    tasks {
      lastQueue {
        name
      }
      channelType
      channelSubType
      aggregation {
        name
        value
      }
    }
  }
}`;
}

export function queueStatsQuery(
  from: number,
  to: number,
  cursor?: string,
): string {
  const pagination = cursor
    ? `pagination: { cursor: ${JSON.stringify(cursor)} }`
    : "";
  // Parked = waiting in queue. lastQueue.duration stays 0 until the contact
  // leaves queue, so wait is computed from parked activity / createdTime.
  return `{
  taskDetails(
    from: ${from}
    to: ${to}
    filter: {
      and: [
        { isActive: { equals: true } }
        { status: { equals: "parked" } }
      ]
    }
    ${pagination}
  ) {
    tasks {
      lastQueue {
        name
      }
      channelType
      channelSubType
      createdTime
      activities {
        nodes {
          eventName
          createdTime
          isActive
          queueName
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;
}

export function agentStateQuery(
  from: number,
  to: number,
  cursor?: string,
): string {
  const pagination = cursor
    ? `pagination: { cursor: ${JSON.stringify(cursor)} }`
    : "";
  // Raw ASR rows (page size 250). Group-by aggregations over channelInfo
  // count channels, not people — a blended agent is many channel records.
  return `{
  agentSession(
    from: ${from}
    to: ${to}
    filter: { isActive: { equals: true } }
    ${pagination}
  ) {
    agentSessions {
      agentId
      agentName
      teamName
      channelInfo {
        currentState
        channelType
        idleCodeName
        lastActivityTime
        activities {
          nodes {
            startTime
            endTime
            duration
            state
            isCurrentActivity
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;
}
