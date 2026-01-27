/**
 * Activity routes
 * GET /api/activity - Get activity feed with pagination and filtering
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { GetActivityFeedParamsSchema } from '../contracts';
import { getActivityFeed } from '../services/activity-log';
import { createLogger } from '../middleware/logging';

const activity = new Hono();

/**
 * GET /api/activity
 * Get aggregated activity feed from all agents
 *
 * Query params:
 * - limit: number of items (default: 50, max: 100)
 * - offset: pagination offset (default: 0)
 * - agent: filter by agent name (optional)
 * - event_type: filter by event type (optional)
 * - since: filter by timestamp (ISO 8601, optional)
 */
activity.get(
  '/',
  zValidator('query', GetActivityFeedParamsSchema),
  async (c) => {
    const logger = createLogger(c);
    const params = c.req.valid('query');

    try {
      logger.info('activity_feed_requested', {
        limit: params.limit,
        offset: params.offset,
        agent: params.agent,
        event_type: params.event_type,
      });

      const result = await getActivityFeed(params);

      logger.info('activity_feed_returned', {
        count: result.activities.length,
        total: result.total,
        has_more: result.has_more,
      });

      return c.json({
        success: true,
        activities: result.activities,
        total: result.total,
        has_more: result.has_more,
      });
    } catch (error) {
      logger.error(
        'activity_feed_error',
        error instanceof Error ? error : 'Unknown error'
      );

      return c.json(
        {
          success: false,
          error: 'Failed to fetch activity feed',
          code: 'ACTIVITY_FEED_ERROR',
        },
        500
      );
    }
  }
);

export { activity };
