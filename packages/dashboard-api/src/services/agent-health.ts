/**
 * Agent health service
 * Checks health status of all Atlas agents via their webhook endpoints
 */
import {
  AgentName,
  HealthStatus,
  AgentStatus,
  AgentMetrics,
} from '../contracts';

// Agent endpoint configuration
const AGENT_ENDPOINTS: Record<AgentName, string> = {
  lead_scorer: process.env.LEAD_SCORER_URL || 'http://localhost:4001',
  reply_handler: process.env.REPLY_HANDLER_URL || 'http://localhost:4002',
  meeting_prep: process.env.MEETING_PREP_URL || 'http://localhost:4003',
  learning_loop: process.env.LEARNING_LOOP_URL || 'http://localhost:4004',
};

// Agent health paths (relative to endpoint)
const AGENT_HEALTH_PATHS: Record<AgentName, string> = {
  lead_scorer: '/health',
  reply_handler: '/health',
  meeting_prep: '/webhook/meeting-prep/health',
  learning_loop: '/health',
};

// Agent display names
const AGENT_DISPLAY_NAMES: Record<AgentName, string> = {
  lead_scorer: 'Lead Scorer',
  reply_handler: 'Reply Handler',
  meeting_prep: 'Meeting Prep',
  learning_loop: 'Learning Loop',
};

// Timeout for health checks (ms)
const HEALTH_CHECK_TIMEOUT = 5000;

interface AgentHealthResponse {
  status: 'healthy' | 'degraded' | 'error' | 'unhealthy';
  timestamp?: string;
  metrics?: Record<string, unknown>;
  error?: string;
}

/**
 * Get default metrics for an agent
 */
function getDefaultMetrics(agentName: AgentName): AgentMetrics {
  const base = { processed_today: 0, errors_today: 0 };

  switch (agentName) {
    case 'lead_scorer':
      return { ...base, avg_score: 0, tier_distribution: {} };
    case 'reply_handler':
      return { ...base, auto_sent: 0, pending_approval: 0 };
    case 'meeting_prep':
      return { ...base, briefs_today: 0 };
    case 'learning_loop':
      return { ...base, insights_today: 0, pending_validation: 0 };
  }
}

/**
 * Check health of a single agent
 */
async function checkAgentHealth(agentName: AgentName): Promise<AgentStatus> {
  const endpoint = AGENT_ENDPOINTS[agentName];
  const healthPath = AGENT_HEALTH_PATHS[agentName];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    const response = await fetch(`${endpoint}${healthPath}`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        name: agentName,
        status: 'error',
        last_activity: null,
        last_activity_summary: null,
        error_message: `HTTP ${response.status}: ${response.statusText}`,
        metrics: getDefaultMetrics(agentName),
        endpoint,
      };
    }

    const data = (await response.json()) as AgentHealthResponse;

    // Map agent status
    let status: HealthStatus = 'unknown';
    if (data.status === 'healthy') status = 'healthy';
    else if (data.status === 'degraded') status = 'warning';
    else if (data.status === 'error' || data.status === 'unhealthy') status = 'error';

    return {
      name: agentName,
      status,
      last_activity: data.timestamp || null,
      last_activity_summary: `${AGENT_DISPLAY_NAMES[agentName]} is operational`,
      error_message: data.error || null,
      metrics: (data.metrics as AgentMetrics) || getDefaultMetrics(agentName),
      endpoint,
    };
  } catch (error) {
    // Handle timeout or network errors
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    const errorMessage = isTimeout
      ? 'Health check timed out'
      : error instanceof Error
        ? error.message
        : 'Unknown error';

    return {
      name: agentName,
      status: 'error',
      last_activity: null,
      last_activity_summary: null,
      error_message: errorMessage,
      metrics: getDefaultMetrics(agentName),
      endpoint,
    };
  }
}

/**
 * Get health status of all agents
 */
export async function getAllAgentStatuses(): Promise<AgentStatus[]> {
  const agentNames: AgentName[] = [
    'lead_scorer',
    'reply_handler',
    'meeting_prep',
    'learning_loop',
  ];

  // Check all agents in parallel
  const statuses = await Promise.all(agentNames.map(checkAgentHealth));

  return statuses;
}

/**
 * Get health status of a single agent
 */
export async function getAgentStatus(agentName: AgentName): Promise<AgentStatus> {
  return checkAgentHealth(agentName);
}

/**
 * Check if an agent name is valid
 */
export function isValidAgentName(name: string): name is AgentName {
  return ['lead_scorer', 'reply_handler', 'meeting_prep', 'learning_loop'].includes(name);
}
