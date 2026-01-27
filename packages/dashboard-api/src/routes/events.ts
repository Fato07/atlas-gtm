/**
 * SSE Events route
 * GET /api/events - Server-Sent Events endpoint for real-time updates
 */
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { sseBroadcaster, generateClientId } from '../services/sse-broadcaster';
import { getCachedStatuses } from '../services/agent-monitor';
import { createLogger } from '../middleware/logging';

const events = new Hono();

/**
 * GET /api/events
 * SSE endpoint for real-time updates
 *
 * Events:
 * - connected: Initial connection confirmation with current state
 * - agent:status: Agent health/metrics changes
 * - activity:new: New activity items
 * - heartbeat: Keep-alive every 30s
 */
events.get('/', async (c) => {
  const logger = createLogger(c);
  const clientId = generateClientId();

  logger.info('sse_connection_requested', { client_id: clientId });

  return streamSSE(c, async (stream) => {
    // Register client with broadcaster
    sseBroadcaster.addClient(clientId, stream);
    logger.info('sse_client_connected', {
      client_id: clientId,
      total_clients: sseBroadcaster.getClientCount(),
    });

    // Handle client disconnect
    stream.onAbort(() => {
      sseBroadcaster.removeClient(clientId);
      logger.info('sse_client_disconnected', {
        client_id: clientId,
        total_clients: sseBroadcaster.getClientCount(),
      });
    });

    // Send initial connected event with current cached state
    const cachedStatuses = getCachedStatuses();
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({
        event: 'connected',
        client_id: clientId,
        timestamp: new Date().toISOString(),
        message: `Connected to Atlas Dashboard SSE. ${sseBroadcaster.getClientCount()} client(s) connected.`,
        cached_statuses: cachedStatuses.map(status => ({
          agent: status.name,
          status: status.status,
          error_message: status.error_message,
          metrics: {
            processed_today: status.metrics.processed_today,
            errors_today: status.metrics.errors_today,
          },
          last_activity: status.last_activity,
          last_activity_summary: status.last_activity_summary,
        })),
      }),
      id: '0',
    });

    // Keep connection alive - the broadcaster handles heartbeats
    // This loop just keeps the stream open
    while (sseBroadcaster.hasClient(clientId)) {
      // Sleep for 1 second, checking if client is still connected
      await stream.sleep(1000);
    }
  });
});

/**
 * GET /api/events/status
 * Get current SSE connection status (for debugging)
 */
events.get('/status', async (c) => {
  return c.json({
    success: true,
    connected_clients: sseBroadcaster.getClientCount(),
    timestamp: new Date().toISOString(),
  });
});

export { events };
