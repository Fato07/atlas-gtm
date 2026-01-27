/**
 * Dashboard API entry point
 * Hono-based BFF (Backend-for-Frontend) for Atlas Operator Dashboard
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth';
import { loggingMiddleware } from './middleware/logging';
import { errorHandler, ErrorCodes } from './middleware/error-handler';
import { agents } from './routes/agents';
import { activity } from './routes/activity';
import { brains } from './routes/brains';
import { icpRules } from './routes/icp-rules';
import templates from './routes/templates';
import handlers from './routes/handlers';
import research from './routes/research';
import pending from './routes/pending';
import metrics from './routes/metrics';
import actions from './routes/actions';
import { events } from './routes/events';
import { startAgentMonitor } from './services/agent-monitor';

// Create Hono app
const app = new Hono();

// ============================================================================
// Global Middleware
// ============================================================================

// CORS - allow dashboard-ui origin
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Dashboard-Secret'],
    credentials: true,
  })
);

// Request logging (dev)
app.use('*', logger());

// Structured logging
app.use('*', loggingMiddleware());

// Error handler - catches all errors and returns structured responses
app.use('*', errorHandler());

// ============================================================================
// Public Routes (no auth required)
// ============================================================================

// Health check endpoint
app.get('/health', async (c) => {
  const timestamp = new Date().toISOString();

  // Basic health check - we'll extend this in T015 to check services
  return c.json({
    status: 'healthy',
    version: '0.1.0',
    timestamp,
    services: {
      mcp_api: 'up',
      qdrant: 'up',
      redis: 'up',
      agents: {
        lead_scorer: 'up',
        reply_handler: 'up',
        meeting_prep: 'up',
        learning_loop: 'up',
      },
    },
  });
});

// ============================================================================
// Protected Routes (require DASHBOARD_SECRET)
// ============================================================================

// Apply auth middleware to all /api/* routes
app.use('/api/*', authMiddleware());

// Route registration
app.route('/api/agents', agents);
app.route('/api/activity', activity);
app.route('/api/brains', brains);
app.route('/api/brains/:brain_id/icp-rules', icpRules);
app.route('/api/brains/:brain_id/templates', templates);
app.route('/api/brains/:brain_id/handlers', handlers);
app.route('/api/brains/:brain_id/research', research);
app.route('/api/pending', pending);
app.route('/api/metrics', metrics);
app.route('/api/actions', actions);
app.route('/api/events', events);

// ============================================================================
// Error Handling (fallback for errors not caught by middleware)
// ============================================================================

app.onError((err, c) => {
  console.error('Unhandled error (fallback):', err);
  return c.json(
    {
      success: false,
      error: err.message || 'Internal server error',
      code: ErrorCodes.INTERNAL_ERROR,
      timestamp: new Date().toISOString(),
    },
    500
  );
});

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Not found',
      code: ErrorCodes.NOT_FOUND,
      timestamp: new Date().toISOString(),
    },
    404
  );
});

// ============================================================================
// Server Start
// ============================================================================

const port = parseInt(process.env.DASHBOARD_API_PORT || '4006', 10);

// Start agent monitor for real-time SSE updates
startAgentMonitor();

console.log(`🚀 Dashboard API starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};

// Export app for testing
export { app };
