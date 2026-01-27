/**
 * Agent status routes
 * GET /api/agents - Get all agent statuses
 * GET /api/agents/:name/health - Get individual agent health
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  getAllAgentStatuses,
  getAgentStatus,
  isValidAgentName,
} from '../services/agent-health';
// Contracts available for response validation if needed
// import { AgentNameSchema, AgentStatusListResponseSchema } from '../contracts';
import { createLogger } from '../middleware/logging';

const agents = new Hono();

/**
 * GET /api/agents
 * Get status of all Atlas agents
 */
agents.get('/', async (c) => {
  const logger = createLogger(c);

  try {
    logger.info('agents_status_requested');

    const statuses = await getAllAgentStatuses();

    const response = {
      success: true as const,
      agents: statuses,
      timestamp: new Date().toISOString(),
    };

    logger.info('agents_status_returned', { agent_count: statuses.length });

    return c.json(response);
  } catch (error) {
    logger.error(
      'agents_status_error',
      error instanceof Error ? error : 'Unknown error'
    );

    return c.json(
      {
        success: false,
        error: 'Failed to fetch agent statuses',
        code: 'AGENT_STATUS_ERROR',
      },
      500
    );
  }
});

// Param validation schema
const agentNameParamSchema = z.object({
  name: z.string(),
});

/**
 * GET /api/agents/:name/health
 * Get health status of a specific agent
 */
agents.get(
  '/:name/health',
  zValidator('param', agentNameParamSchema),
  async (c) => {
    const logger = createLogger(c);
    const { name } = c.req.valid('param');

    // Validate agent name
    if (!isValidAgentName(name)) {
      return c.json(
        {
          success: false,
          error: `Invalid agent name: ${name}. Valid names are: lead_scorer, reply_handler, meeting_prep, learning_loop`,
          code: 'INVALID_AGENT_NAME',
        },
        400
      );
    }

    try {
      logger.info('agent_health_requested', { agent_name: name });

      const status = await getAgentStatus(name);

      logger.info('agent_health_returned', {
        agent_name: name,
        status: status.status,
      });

      return c.json({
        success: true,
        agent: status,
      });
    } catch (error) {
      logger.error(
        'agent_health_error',
        error instanceof Error ? error : 'Unknown error',
        { agent_name: name }
      );

      return c.json(
        {
          success: false,
          error: `Failed to fetch health for agent: ${name}`,
          code: 'AGENT_HEALTH_ERROR',
        },
        500
      );
    }
  }
);

export { agents };
