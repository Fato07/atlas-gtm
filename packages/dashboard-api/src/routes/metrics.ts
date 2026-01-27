/**
 * Metrics API routes
 * Aggregated dashboard metrics with configurable time periods
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { aggregateMetrics } from '../services/metrics';

const metrics = new Hono();

// Query parameter validation
const MetricsQuerySchema = z.object({
  period: z.enum(['today', '7d', '30d']).default('today'),
});

/**
 * GET /api/metrics
 * Returns aggregated metrics for the specified period
 *
 * @query period - Time period: today | 7d | 30d (default: today)
 */
metrics.get('/', zValidator('query', MetricsQuerySchema), async (c) => {
  try {
    const { period } = c.req.valid('query');

    const metricsData = await aggregateMetrics(period);

    return c.json({
      success: true,
      data: metricsData,
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch metrics',
        code: 'METRICS_ERROR',
      },
      500
    );
  }
});

/**
 * GET /api/metrics/summary
 * Returns a simplified metrics summary (for widgets)
 */
metrics.get('/summary', zValidator('query', MetricsQuerySchema), async (c) => {
  try {
    const { period } = c.req.valid('query');

    const metricsData = await aggregateMetrics(period);

    // Return simplified summary for dashboard widgets
    return c.json({
      success: true,
      data: {
        leads_scored: metricsData.leads_scored,
        tier1_count: metricsData.leads_by_tier.tier1,
        replies_classified: metricsData.replies_classified,
        interested_count: metricsData.replies_by_category.interested,
        briefs_generated: metricsData.briefs_generated,
        insights_extracted: metricsData.insights_extracted,
        period: metricsData.period,
        timestamp: metricsData.timestamp,
      },
    });
  } catch (error) {
    console.error('Error fetching metrics summary:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch metrics summary',
        code: 'METRICS_SUMMARY_ERROR',
      },
      500
    );
  }
});

export { metrics };
export default metrics;
