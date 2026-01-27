/**
 * React Query hook for agent status data
 * Uses SSE for real-time updates with fallback to 30-second polling
 */
import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '@/services/api';
import { useSSE } from './useSSE';

export type AgentName = 'lead_scorer' | 'reply_handler' | 'meeting_prep' | 'learning_loop';
export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown';

export interface AgentMetrics {
  processed_today: number;
  errors_today: number;
  // Agent-specific metrics
  avg_score?: number;
  tier_distribution?: Record<string, number>;
  auto_sent?: number;
  pending_approval?: number;
  briefs_today?: number;
  insights_today?: number;
  pending_validation?: number;
}

export interface AgentStatus {
  name: AgentName;
  status: HealthStatus;
  last_activity: string | null;
  last_activity_summary: string | null;
  error_message: string | null;
  metrics: AgentMetrics;
  endpoint: string;
}

interface AgentStatusResponse {
  success: true;
  agents: AgentStatus[];
  timestamp: string;
}

interface AgentHealthResponse {
  success: true;
  agent: AgentStatus;
}

/**
 * Query key factory for agent status queries
 */
export const agentStatusKeys = {
  all: ['agents'] as const,
  list: () => [...agentStatusKeys.all, 'list'] as const,
  detail: (name: AgentName) => [...agentStatusKeys.all, 'detail', name] as const,
};

/**
 * Hook to fetch all agent statuses
 * Uses SSE for real-time updates with fallback to 30-second polling when disconnected
 */
export function useAgentStatuses() {
  const { isConnected } = useSSE();

  return useQuery({
    queryKey: agentStatusKeys.list(),
    queryFn: async (): Promise<AgentStatus[]> => {
      const response = (await agentsApi.getAll()) as AgentStatusResponse;
      return response.agents;
    },
    // Only poll if SSE is disconnected (fallback polling)
    refetchInterval: isConnected ? false : 30 * 1000,
    // Longer stale time when SSE is connected (updates come via SSE)
    staleTime: isConnected ? 60 * 1000 : 15 * 1000,
  });
}

/**
 * Hook to fetch a single agent's health status
 * Uses SSE for real-time updates with fallback polling
 */
export function useAgentHealth(name: AgentName) {
  const { isConnected } = useSSE();

  return useQuery({
    queryKey: agentStatusKeys.detail(name),
    queryFn: async (): Promise<AgentStatus> => {
      const response = (await agentsApi.getHealth(name)) as AgentHealthResponse;
      return response.agent;
    },
    refetchInterval: isConnected ? false : 30 * 1000,
    staleTime: isConnected ? 60 * 1000 : 15 * 1000,
  });
}

/**
 * Display names for agents
 */
export const AGENT_DISPLAY_NAMES: Record<AgentName, string> = {
  lead_scorer: 'Lead Scorer',
  reply_handler: 'Reply Handler',
  meeting_prep: 'Meeting Prep',
  learning_loop: 'Learning Loop',
};

/**
 * Agent descriptions
 */
export const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  lead_scorer: 'Scores and categorizes incoming leads based on ICP rules',
  reply_handler: 'Classifies email replies and suggests responses',
  meeting_prep: 'Generates pre-call briefs and post-call analysis',
  learning_loop: 'Extracts insights and learns from interactions',
};

/**
 * Get status color class
 */
export function getStatusColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'text-success';
    case 'warning':
      return 'text-warning';
    case 'error':
      return 'text-error';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Get status background color class
 */
export function getStatusBgColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-success';
    case 'warning':
      return 'bg-warning';
    case 'error':
      return 'bg-error';
    default:
      return 'bg-muted-foreground';
  }
}

/**
 * Format relative time from ISO timestamp
 */
export function formatRelativeTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) return 'Never';

  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString();
}
