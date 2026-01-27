/**
 * SSE (Server-Sent Events) contracts for real-time updates
 * @module contracts/sse-events
 */
import { z } from 'zod';
import { AgentNameSchema, HealthStatusSchema } from './common';

// ============================================================================
// SSE Event Types
// ============================================================================

export const SSEEventTypeSchema = z.enum([
  'connected',      // Initial connection confirmation
  'agent:status',   // Agent health/metrics change
  'activity:new',   // New activity item
  'heartbeat',      // Keep-alive (30s)
]);
export type SSEEventType = z.infer<typeof SSEEventTypeSchema>;

// ============================================================================
// Event Payloads
// ============================================================================

/**
 * Connected event - sent when client establishes SSE connection
 */
export const ConnectedEventSchema = z.object({
  event: z.literal('connected'),
  client_id: z.string(),
  timestamp: z.string().datetime(),
  message: z.string(),
});
export type ConnectedEvent = z.infer<typeof ConnectedEventSchema>;

/**
 * Agent status change event - sent when agent health/metrics change
 */
export const AgentStatusEventSchema = z.object({
  event: z.literal('agent:status'),
  agent: AgentNameSchema,
  status: HealthStatusSchema,
  previous_status: HealthStatusSchema.nullable(),
  error_message: z.string().nullable(),
  metrics: z.object({
    processed_today: z.number().int().min(0),
    errors_today: z.number().int().min(0),
  }),
  last_activity: z.string().datetime().nullable(),
  last_activity_summary: z.string().nullable(),
  timestamp: z.string().datetime(),
});
export type AgentStatusEvent = z.infer<typeof AgentStatusEventSchema>;

/**
 * Activity new event - sent when a new activity item is recorded
 */
export const ActivityNewEventSchema = z.object({
  event: z.literal('activity:new'),
  activity_id: z.string(),
  agent: AgentNameSchema,
  event_type: z.string(),
  summary: z.string(),
  timestamp: z.string().datetime(),
});
export type ActivityNewEvent = z.infer<typeof ActivityNewEventSchema>;

/**
 * Heartbeat event - keep-alive sent every 30 seconds
 */
export const HeartbeatEventSchema = z.object({
  event: z.literal('heartbeat'),
  timestamp: z.string().datetime(),
});
export type HeartbeatEvent = z.infer<typeof HeartbeatEventSchema>;

/**
 * Union of all SSE events
 */
export const SSEEventSchema = z.discriminatedUnion('event', [
  ConnectedEventSchema,
  AgentStatusEventSchema,
  ActivityNewEventSchema,
  HeartbeatEventSchema,
]);
export type SSEEvent = z.infer<typeof SSEEventSchema>;

// ============================================================================
// SSE Connection State
// ============================================================================

export const SSEConnectionStateSchema = z.enum([
  'connecting',
  'connected',
  'disconnected',
  'reconnecting',
  'error',
]);
export type SSEConnectionState = z.infer<typeof SSEConnectionStateSchema>;
