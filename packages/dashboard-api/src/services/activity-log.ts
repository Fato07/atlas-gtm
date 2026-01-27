/**
 * Activity log service
 * Aggregates activities from agent state files and provides unified activity feed
 */
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  ActivityEvent,
  GetActivityFeedParams,
  AgentName,
  EventType,
} from '../contracts';

// State file locations (relative to project root)
const STATE_DIR = process.env.STATE_DIR || join(process.cwd(), '..', '..', 'state');

const AGENT_STATE_FILES: Record<AgentName, string> = {
  lead_scorer: 'lead_scorer-state.json',
  reply_handler: 'reply_handler-state.json',
  meeting_prep: 'meeting_prep-state.json',
  learning_loop: 'learning_loop-state.json',
};

interface AgentStateActivity {
  id: string;
  timestamp: string;
  type: string;
  summary: string;
  lead_id?: string;
  brain_id?: string;
  details_link?: string;
}

interface AgentState {
  activities?: AgentStateActivity[];
  recent_events?: AgentStateActivity[];
  processed?: Array<{
    id: string;
    timestamp: string;
    email?: string;
    company?: string;
    score?: number;
    tier?: number;
    category?: string;
  }>;
}

/**
 * Map agent-specific event types to unified event types
 */
function mapEventType(agentName: AgentName, rawType: string): EventType {
  const typeMap: Record<string, EventType> = {
    // Lead Scorer events
    scored: 'lead_scored',
    lead_scored: 'lead_scored',

    // Reply Handler events
    classified: 'reply_classified',
    reply_classified: 'reply_classified',
    sent: 'reply_sent',
    reply_sent: 'reply_sent',

    // Meeting Prep events
    brief_generated: 'brief_generated',
    brief_delivered: 'brief_delivered',
    generated: 'brief_generated',
    delivered: 'brief_delivered',

    // Learning Loop events
    insight_extracted: 'insight_extracted',
    insight_validated: 'insight_validated',
    extracted: 'insight_extracted',
    validated: 'insight_validated',

    // Error events
    error: 'error',
    failed: 'error',
  };

  return typeMap[rawType.toLowerCase()] || 'error';
}

/**
 * Parse activities from an agent's state file
 */
async function parseAgentState(agentName: AgentName): Promise<ActivityEvent[]> {
  const stateFile = join(STATE_DIR, AGENT_STATE_FILES[agentName]);

  if (!existsSync(stateFile)) {
    return [];
  }

  try {
    const content = await readFile(stateFile, 'utf-8');
    const state: AgentState = JSON.parse(content);

    const activities: ActivityEvent[] = [];

    // Parse activities array if present
    if (state.activities && Array.isArray(state.activities)) {
      for (const activity of state.activities) {
        activities.push({
          id: activity.id || crypto.randomUUID(),
          timestamp: activity.timestamp,
          agent: agentName,
          event_type: mapEventType(agentName, activity.type),
          summary: activity.summary,
          details_link: activity.details_link || null,
          lead_id: activity.lead_id || null,
          brain_id: activity.brain_id || null,
        });
      }
    }

    // Parse recent_events array if present
    if (state.recent_events && Array.isArray(state.recent_events)) {
      for (const event of state.recent_events) {
        activities.push({
          id: event.id || crypto.randomUUID(),
          timestamp: event.timestamp,
          agent: agentName,
          event_type: mapEventType(agentName, event.type),
          summary: event.summary,
          details_link: event.details_link || null,
          lead_id: event.lead_id || null,
          brain_id: event.brain_id || null,
        });
      }
    }

    // Parse processed array (lead scorer format) if present
    if (state.processed && Array.isArray(state.processed)) {
      for (const item of state.processed) {
        const summary = item.company
          ? `Scored ${item.email} (${item.company}) - Score: ${item.score}, Tier ${item.tier}`
          : `Scored ${item.email} - Score: ${item.score}, Tier ${item.tier}`;

        activities.push({
          id: item.id || crypto.randomUUID(),
          timestamp: item.timestamp,
          agent: agentName,
          event_type: 'lead_scored',
          summary,
          details_link: null,
          lead_id: item.email || null,
          brain_id: null,
        });
      }
    }

    return activities;
  } catch {
    // State file exists but couldn't be parsed
    return [];
  }
}


/**
 * Get aggregated activity feed from all agents
 */
export async function getActivityFeed(params: GetActivityFeedParams): Promise<{
  activities: ActivityEvent[];
  total: number;
  has_more: boolean;
}> {
  const { limit, offset, agent, event_type, since } = params;

  // Aggregate activities from all agent state files
  const allActivities: ActivityEvent[] = [];

  const agents: AgentName[] = agent
    ? [agent]
    : ['lead_scorer', 'reply_handler', 'meeting_prep', 'learning_loop'];

  for (const agentName of agents) {
    const agentActivities = await parseAgentState(agentName);
    allActivities.push(...agentActivities);
  }

  // Filter by event_type if specified
  let filtered = event_type
    ? allActivities.filter(a => a.event_type === event_type)
    : allActivities;

  // Filter by since timestamp if specified
  if (since) {
    const sinceDate = new Date(since);
    filtered = filtered.filter(a => new Date(a.timestamp) >= sinceDate);
  }

  // Sort by timestamp descending (most recent first)
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply pagination
  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);
  const has_more = offset + paginated.length < total;

  return {
    activities: paginated,
    total,
    has_more,
  };
}

/**
 * Get activity count by type for metrics
 */
export async function getActivityCounts(since?: Date): Promise<Record<EventType, number>> {
  const { activities } = await getActivityFeed({
    limit: 1000,
    offset: 0,
    since: since?.toISOString(),
  });

  const counts: Record<EventType, number> = {
    lead_scored: 0,
    reply_classified: 0,
    reply_sent: 0,
    brief_generated: 0,
    brief_delivered: 0,
    insight_extracted: 0,
    insight_validated: 0,
    error: 0,
  };

  for (const activity of activities) {
    counts[activity.event_type]++;
  }

  return counts;
}
