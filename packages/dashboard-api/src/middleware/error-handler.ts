/**
 * Comprehensive error handling middleware for Dashboard API
 * Provides structured error responses with proper HTTP status codes
 */
import type { Context, MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

// Error codes for client consumption
export const ErrorCodes = {
  // Client errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  MCP_ERROR: 'MCP_ERROR',
  QDRANT_ERROR: 'QDRANT_ERROR',
  AGENT_ERROR: 'AGENT_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// Structured error response
export interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

// Custom application error
export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public status: ContentfulStatusCode = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Helper functions to create common errors
export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError(message, ErrorCodes.VALIDATION_ERROR, 400, details);
}

export function notFoundError(resource: string): AppError {
  return new AppError(`${resource} not found`, ErrorCodes.NOT_FOUND, 404);
}

export function authError(message = 'Authentication required'): AppError {
  return new AppError(message, ErrorCodes.AUTHENTICATION_ERROR, 401);
}

export function forbiddenError(message = 'Access denied'): AppError {
  return new AppError(message, ErrorCodes.AUTHORIZATION_ERROR, 403);
}

export function conflictError(message: string): AppError {
  return new AppError(message, ErrorCodes.CONFLICT, 409);
}

export function serviceError(service: string, message: string): AppError {
  const code =
    service === 'mcp'
      ? ErrorCodes.MCP_ERROR
      : service === 'qdrant'
        ? ErrorCodes.QDRANT_ERROR
        : service === 'agent'
          ? ErrorCodes.AGENT_ERROR
          : ErrorCodes.SERVICE_UNAVAILABLE;
  return new AppError(`${service} service error: ${message}`, code, 503);
}

/**
 * Format Zod validation errors into a user-friendly structure
 */
function formatZodError(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    const key = path || 'root';
    if (!formatted[key]) {
      formatted[key] = [];
    }
    formatted[key].push(issue.message);
  }

  return formatted;
}

/**
 * Build error response object
 */
function buildErrorResponse(
  message: string,
  code: ErrorCode,
  details?: Record<string, unknown>,
  requestId?: string
): ErrorResponse {
  return {
    success: false,
    error: message,
    code,
    details,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

/**
 * Error handling middleware
 * Catches all errors and returns structured JSON responses
 */
export function errorHandler(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      await next();
    } catch (err) {
      const requestId = c.req.header('x-request-id');

      // Handle Zod validation errors
      if (err instanceof ZodError) {
        const response = buildErrorResponse(
          'Validation failed',
          ErrorCodes.VALIDATION_ERROR,
          { fields: formatZodError(err) },
          requestId
        );
        return c.json(response, 400);
      }

      // Handle custom application errors
      if (err instanceof AppError) {
        const response = buildErrorResponse(err.message, err.code, err.details, requestId);
        return c.json(response, err.status);
      }

      // Handle Hono HTTP exceptions
      if (err instanceof HTTPException) {
        const code =
          err.status === 401
            ? ErrorCodes.AUTHENTICATION_ERROR
            : err.status === 403
              ? ErrorCodes.AUTHORIZATION_ERROR
              : err.status === 404
                ? ErrorCodes.NOT_FOUND
                : err.status === 429
                  ? ErrorCodes.RATE_LIMITED
                  : ErrorCodes.INTERNAL_ERROR;

        const response = buildErrorResponse(err.message || 'HTTP error', code, undefined, requestId);
        return c.json(response, err.status);
      }

      // Handle fetch errors (network issues with MCP/agents)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        const response = buildErrorResponse(
          'Service connection failed',
          ErrorCodes.SERVICE_UNAVAILABLE,
          { originalError: err.message },
          requestId
        );
        return c.json(response, 503);
      }

      // Handle unknown errors
      console.error('Unhandled error:', err);

      // Don't expose internal error details in production
      const isDev = process.env.NODE_ENV === 'development';
      const message = isDev && err instanceof Error ? err.message : 'Internal server error';
      const details = isDev && err instanceof Error ? { stack: err.stack } : undefined;

      const response = buildErrorResponse(message, ErrorCodes.INTERNAL_ERROR, details, requestId);
      return c.json(response, 500);
    }
  };
}

/**
 * Async handler wrapper that catches errors and passes them to error middleware
 * Use this to wrap route handlers that perform async operations
 */
export function asyncHandler<T>(
  handler: (c: Context) => Promise<T>
): (c: Context) => Promise<T | Response> {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (err) {
      // Re-throw to be caught by error middleware
      throw err;
    }
  };
}
