/**
 * SSE Broadcaster Service
 * Manages SSE client connections and broadcasts events to all connected clients
 */
import type { SSEStreamingApi } from 'hono/streaming';
import type { SSEEvent, AgentStatusEvent, ActivityNewEvent } from '../contracts/sse-events';

interface SSEClient {
  id: string;
  stream: SSEStreamingApi;
  connectedAt: Date;
}

/**
 * SSE Broadcaster - Singleton that manages all SSE connections
 * and broadcasts events to connected clients
 */
class SSEBroadcasterService {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private messageId: number = 0;

  /**
   * Add a new SSE client connection
   */
  addClient(id: string, stream: SSEStreamingApi): void {
    this.clients.set(id, {
      id,
      stream,
      connectedAt: new Date(),
    });

    console.log(`[SSE] Client connected: ${id} (total: ${this.clients.size})`);

    // Start heartbeat if this is the first client
    if (this.clients.size === 1) {
      this.startHeartbeat();
    }
  }

  /**
   * Remove an SSE client connection
   */
  removeClient(id: string): void {
    this.clients.delete(id);
    console.log(`[SSE] Client disconnected: ${id} (total: ${this.clients.size})`);

    // Stop heartbeat if no clients connected
    if (this.clients.size === 0) {
      this.stopHeartbeat();
    }
  }

  /**
   * Check if a client is connected
   */
  hasClient(id: string): boolean {
    return this.clients.has(id);
  }

  /**
   * Get count of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Broadcast an event to all connected clients
   */
  async broadcast(eventType: string, data: unknown): Promise<void> {
    if (this.clients.size === 0) return;

    const messageId = String(++this.messageId);
    const payload = JSON.stringify(data);

    const promises: Promise<void>[] = [];
    const failedClients: string[] = [];

    for (const [clientId, client] of this.clients) {
      promises.push(
        client.stream
          .writeSSE({
            event: eventType,
            data: payload,
            id: messageId,
          })
          .catch((error) => {
            console.error(`[SSE] Failed to send to client ${clientId}:`, error);
            failedClients.push(clientId);
          })
      );
    }

    await Promise.all(promises);

    // Remove failed clients
    for (const clientId of failedClients) {
      this.removeClient(clientId);
    }
  }

  /**
   * Broadcast agent status change
   */
  async broadcastAgentStatus(event: AgentStatusEvent): Promise<void> {
    await this.broadcast('agent:status', event);
  }

  /**
   * Broadcast new activity event
   */
  async broadcastActivityNew(event: ActivityNewEvent): Promise<void> {
    await this.broadcast('activity:new', event);
  }

  /**
   * Start heartbeat interval (30s)
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat();
    }, 30 * 1000); // 30 seconds

    console.log('[SSE] Heartbeat started');
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[SSE] Heartbeat stopped');
    }
  }

  /**
   * Send heartbeat to all clients
   */
  async sendHeartbeat(): Promise<void> {
    await this.broadcast('heartbeat', {
      event: 'heartbeat',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Clean up all connections (for shutdown)
   */
  cleanup(): void {
    this.stopHeartbeat();
    this.clients.clear();
    console.log('[SSE] All clients cleaned up');
  }
}

// Export singleton instance
export const sseBroadcaster = new SSEBroadcasterService();

// Generate unique client ID
export function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
