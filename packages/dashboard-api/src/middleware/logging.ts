/**
 * Structured logging middleware for Dashboard API
 * Provides JSON-formatted request/response logging
 */
import { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  method: string;
  path: string;
  status?: number;
  duration_ms?: number;
  error?: string;
  request_id?: string;
  [key: string]: unknown;
}

/**
 * Generate a short request ID
 */
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Log entry to stdout as JSON
 */
function log(entry: LogEntry): void {
  console.log(JSON.stringify(entry));
}

/**
 * Structured logging middleware factory
 */
export function loggingMiddleware() {
  return createMiddleware(async (c: Context, next: Next) => {
    const requestId = generateRequestId();
    const startTime = Date.now();

    // Attach request ID to context for use in handlers
    c.set('requestId', requestId);

    // Log request start
    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'request_start',
      method: c.req.method,
      path: c.req.path,
      request_id: requestId,
    });

    try {
      await next();

      // Log successful response
      const duration = Date.now() - startTime;
      log({
        timestamp: new Date().toISOString(),
        level: 'info',
        event: 'request_complete',
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration_ms: duration,
        request_id: requestId,
      });
    } catch (error) {
      // Log error
      const duration = Date.now() - startTime;
      log({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'request_error',
        method: c.req.method,
        path: c.req.path,
        duration_ms: duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        request_id: requestId,
      });

      throw error;
    }
  });
}

/**
 * Create a logger bound to a request context
 */
export function createLogger(c: Context) {
  const requestId = c.get('requestId') as string | undefined;

  return {
    info: (event: string, data?: Record<string, unknown>) => {
      log({
        timestamp: new Date().toISOString(),
        level: 'info',
        event,
        method: c.req.method,
        path: c.req.path,
        request_id: requestId,
        ...data,
      });
    },
    warn: (event: string, data?: Record<string, unknown>) => {
      log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        event,
        method: c.req.method,
        path: c.req.path,
        request_id: requestId,
        ...data,
      });
    },
    error: (event: string, error: Error | string, data?: Record<string, unknown>) => {
      log({
        timestamp: new Date().toISOString(),
        level: 'error',
        event,
        method: c.req.method,
        path: c.req.path,
        error: error instanceof Error ? error.message : error,
        request_id: requestId,
        ...data,
      });
    },
  };
}
