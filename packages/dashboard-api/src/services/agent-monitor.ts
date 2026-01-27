/**
 * Agent Monitor Service
 * Polls agents every 5 seconds, detects status changes, and broadcasts via SSE
 */
import { getAllAgentStatuses } from './agent-health';
import { sseBroadcaster } from './sse-broadcaster';
import type { AgentName, AgentStatus } from '../contracts';

// Polling interval (5 seconds)
const POLL_INTERVAL_MS = 5000;

// Last known status for each agent (for change detection)
const lastStatuses: Map<AgentName, AgentStatus> = new Map();

// Monitor state
let pollInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Check if agent status has meaningfully changed
 */
function hasStatusChanged(
  previous: AgentStatus | undefined,
  current: AgentStatus
): boolean {
  // First time seeing this agent
  if (!previous) return true;

  // Status changed
  if (previous.status !== current.status) return true;

  // Error message changed
  if (previous.error_message !== current.error_message) return true;

  // Metrics changed significantly (processed or errors count changed)
  if (previous.metrics.processed_today !== current.metrics.processed_today) return true;
  if (previous.metrics.errors_today !== current.metrics.errors_today) return true;

  // Last activity changed
  if (previous.last_activity !== current.last_activity) return true;

  return false;
}

/**
 * Poll all agents and broadcast changes
 */
async function pollAgents(): Promise<void> {
  try {
    const statuses = await getAllAgentStatuses();

    for (const status of statuses) {
      const previousStatus = lastStatuses.get(status.name);

      if (hasStatusChanged(previousStatus, status)) {
        // Broadcast the change
        await sseBroadcaster.broadcastAgentStatus({
          event: 'agent:status',
          agent: status.name,
          status: status.status,
          previous_status: previousStatus?.status ?? null,
          error_message: status.error_message,
          metrics: {
            processed_today: status.metrics.processed_today,
            errors_today: status.metrics.errors_today,
          },
          last_activity: status.last_activity,
          last_activity_summary: status.last_activity_summary,
          timestamp: new Date().toISOString(),
        });

        console.log(
          `[AgentMonitor] Status change detected for ${status.name}: ` +
            `${previousStatus?.status ?? 'unknown'} -> ${status.status}`
        );
      }

      // Update last known status
      lastStatuses.set(status.name, status);
    }
  } catch (error) {
    console.error('[AgentMonitor] Error polling agents:', error);
  }
}

/**
 * Start the agent monitor
 */
export function startAgentMonitor(): void {
  if (isRunning) {
    console.log('[AgentMonitor] Already running');
    return;
  }

  console.log('[AgentMonitor] Starting agent monitor (polling every 5s)');
  isRunning = true;

  // Initial poll
  pollAgents().catch(console.error);

  // Set up interval polling
  pollInterval = setInterval(() => {
    pollAgents().catch(console.error);
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the agent monitor
 */
export function stopAgentMonitor(): void {
  if (!isRunning) {
    console.log('[AgentMonitor] Not running');
    return;
  }

  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  isRunning = false;
  lastStatuses.clear();
  console.log('[AgentMonitor] Stopped');
}

/**
 * Check if the monitor is running
 */
export function isAgentMonitorRunning(): boolean {
  return isRunning;
}

/**
 * Get current cached statuses (for SSE connected event)
 */
export function getCachedStatuses(): AgentStatus[] {
  return Array.from(lastStatuses.values());
}

/**
 * Force a poll (useful for manual refresh)
 */
export async function forcePoll(): Promise<void> {
  await pollAgents();
}
