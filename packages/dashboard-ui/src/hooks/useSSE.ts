/**
 * SSE (Server-Sent Events) hook for real-time updates
 * Manages EventSource connection with React Query cache integration
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { agentStatusKeys, type AgentStatus, type HealthStatus } from './useAgentStatus';
import { activityKeys } from './useActivity';

// SSE connection states
export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

// Reconnection backoff delays (in ms)
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

// Build the SSE endpoint URL
function getSSEUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const dashboardSecret = import.meta.env.VITE_DASHBOARD_SECRET || '';

  // For SSE, we need the full URL with proper origin
  // If VITE_API_URL is /api (relative), we need the full URL
  let sseUrl: string;
  if (baseUrl.startsWith('http')) {
    sseUrl = `${baseUrl}/events`;
  } else {
    // Relative path - construct full URL
    sseUrl = `${window.location.origin}${baseUrl}/events`;
  }

  // Add auth via query param since EventSource doesn't support headers
  if (dashboardSecret) {
    sseUrl += `?secret=${encodeURIComponent(dashboardSecret)}`;
  }

  return sseUrl;
}

// Event payload types
interface AgentStatusEventPayload {
  event: 'agent:status';
  agent: AgentStatus['name'];
  status: HealthStatus;
  previous_status: HealthStatus | null;
  error_message: string | null;
  metrics: {
    processed_today: number;
    errors_today: number;
  };
  last_activity: string | null;
  last_activity_summary: string | null;
  timestamp: string;
}

interface ActivityNewEventPayload {
  event: 'activity:new';
  activity_id: string;
  agent: AgentStatus['name'];
  event_type: string;
  summary: string;
  timestamp: string;
}

interface ConnectedEventPayload {
  event: 'connected';
  client_id: string;
  timestamp: string;
  message: string;
  cached_statuses?: Array<{
    agent: AgentStatus['name'];
    status: HealthStatus;
    error_message: string | null;
    metrics: {
      processed_today: number;
      errors_today: number;
    };
    last_activity: string | null;
    last_activity_summary: string | null;
  }>;
}

interface HeartbeatEventPayload {
  event: 'heartbeat';
  timestamp: string;
}

// Union type for all SSE event payloads (used for type checking)
type _SSEEventPayload =
  | AgentStatusEventPayload
  | ActivityNewEventPayload
  | ConnectedEventPayload
  | HeartbeatEventPayload;
export type { _SSEEventPayload as SSEEventPayload };

export interface UseSSEReturn {
  /** Current connection state */
  status: SSEConnectionState;
  /** Whether the SSE connection is active */
  isConnected: boolean;
  /** Manually trigger reconnection */
  reconnect: () => void;
  /** Client ID assigned by server */
  clientId: string | null;
  /** Last event timestamp */
  lastEventTime: Date | null;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
}

/**
 * Hook to manage SSE connection for real-time updates
 * Automatically updates React Query cache on events
 */
export function useSSE(): UseSSEReturn {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<SSEConnectionState>('disconnected');
  const [clientId, setClientId] = useState<string | null>(null);
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Connect to SSE
  const connect = useCallback(() => {
    cleanup();
    setStatus('connecting');

    try {
      const url = getSSEUrl();
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // Connection opened
      eventSource.onopen = () => {
        console.log('[SSE] Connection established');
        setStatus('connected');
        reconnectAttemptRef.current = 0;
      };

      // Handle connected event
      eventSource.addEventListener('connected', (event) => {
        try {
          const data = JSON.parse(event.data) as ConnectedEventPayload;
          console.log('[SSE] Connected:', data.message);
          setClientId(data.client_id);
          setLastEventTime(new Date(data.timestamp));

          // If cached statuses are provided, update React Query cache
          if (data.cached_statuses && data.cached_statuses.length > 0) {
            queryClient.setQueryData(agentStatusKeys.list(), (old: AgentStatus[] | undefined) => {
              if (!old) return old;
              return old.map(agent => {
                const cached = data.cached_statuses?.find(s => s.agent === agent.name);
                if (cached) {
                  return {
                    ...agent,
                    status: cached.status,
                    error_message: cached.error_message,
                    metrics: {
                      ...agent.metrics,
                      processed_today: cached.metrics.processed_today,
                      errors_today: cached.metrics.errors_today,
                    },
                    last_activity: cached.last_activity,
                    last_activity_summary: cached.last_activity_summary,
                  };
                }
                return agent;
              });
            });
          }
        } catch (error) {
          console.error('[SSE] Error parsing connected event:', error);
        }
      });

      // Handle agent:status events
      eventSource.addEventListener('agent:status', (event) => {
        try {
          const data = JSON.parse(event.data) as AgentStatusEventPayload;
          console.log(`[SSE] Agent status: ${data.agent} ${data.previous_status} -> ${data.status}`);
          setLastEventTime(new Date(data.timestamp));

          // Update React Query cache directly
          queryClient.setQueryData(agentStatusKeys.list(), (old: AgentStatus[] | undefined) => {
            if (!old) return old;
            return old.map(agent => {
              if (agent.name === data.agent) {
                return {
                  ...agent,
                  status: data.status,
                  error_message: data.error_message,
                  metrics: {
                    ...agent.metrics,
                    processed_today: data.metrics.processed_today,
                    errors_today: data.metrics.errors_today,
                  },
                  last_activity: data.last_activity,
                  last_activity_summary: data.last_activity_summary,
                };
              }
              return agent;
            });
          });
        } catch (error) {
          console.error('[SSE] Error parsing agent:status event:', error);
        }
      });

      // Handle activity:new events
      eventSource.addEventListener('activity:new', (event) => {
        try {
          const data = JSON.parse(event.data) as ActivityNewEventPayload;
          console.log('[SSE] New activity:', data.summary);
          setLastEventTime(new Date(data.timestamp));

          // Invalidate activity queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: activityKeys.all });
        } catch (error) {
          console.error('[SSE] Error parsing activity:new event:', error);
        }
      });

      // Handle heartbeat events
      eventSource.addEventListener('heartbeat', (event) => {
        try {
          const data = JSON.parse(event.data) as HeartbeatEventPayload;
          setLastEventTime(new Date(data.timestamp));
        } catch (error) {
          console.error('[SSE] Error parsing heartbeat event:', error);
        }
      });

      // Handle errors and reconnection
      eventSource.onerror = () => {
        console.error('[SSE] Connection error, attempting reconnect...');
        cleanup();

        // Calculate reconnect delay with exponential backoff
        const attempt = reconnectAttemptRef.current;
        const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];

        setStatus('reconnecting');
        reconnectAttemptRef.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      setStatus('error');
    }
  }, [queryClient, cleanup]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    connect();
  }, [connect]);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return {
    status,
    isConnected: status === 'connected',
    reconnect,
    clientId,
    lastEventTime,
    reconnectAttempts: reconnectAttemptRef.current,
  };
}

/**
 * Context provider for SSE (optional - for sharing state across components)
 * Can be used if multiple components need to access SSE state without
 * creating multiple connections
 */
export { useSSE as default };
