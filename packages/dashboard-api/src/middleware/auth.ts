/**
 * Authentication middleware for Dashboard API
 * Validates X-Dashboard-Secret header against DASHBOARD_SECRET env var
 */
import { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';

const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET;

/**
 * Auth middleware factory
 * Validates requests have a valid X-Dashboard-Secret header
 */
export function authMiddleware() {
  return createMiddleware(async (c: Context, next: Next) => {
    // Check if DASHBOARD_SECRET is configured
    if (!DASHBOARD_SECRET) {
      console.warn(
        'DASHBOARD_SECRET not configured - authentication disabled in development'
      );
      // In development, allow requests without auth if secret not configured
      if (process.env.NODE_ENV === 'development') {
        await next();
        return;
      }
      return c.json(
        {
          success: false,
          error: 'Server configuration error',
          code: 'AUTH_CONFIG_ERROR',
        },
        500
      );
    }

    // Get secret from header or query param (SSE doesn't support custom headers)
    const headerSecret = c.req.header('X-Dashboard-Secret');
    const querySecret = c.req.query('secret');
    const providedSecret = headerSecret || querySecret;

    if (!providedSecret) {
      return c.json(
        {
          success: false,
          error: 'Missing X-Dashboard-Secret header or secret query parameter',
          code: 'AUTH_MISSING',
        },
        401
      );
    }

    // Constant-time comparison to prevent timing attacks
    if (!secureCompare(providedSecret, DASHBOARD_SECRET)) {
      return c.json(
        {
          success: false,
          error: 'Invalid authentication token',
          code: 'AUTH_INVALID',
        },
        401
      );
    }

    await next();
  });
}

/**
 * Constant-time string comparison
 * Prevents timing attacks on authentication
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
