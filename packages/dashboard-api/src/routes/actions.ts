/**
 * Actions API routes
 * Manual trigger endpoints for agent actions
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const actions = new Hono();

// Request schemas
const ScoreLeadSchema = z.object({
  email: z.string().email('Invalid email format'),
  brain_id: z.string().min(1, 'Brain ID is required'),
  force_rescore: z.boolean().default(false),
});

const GenerateBriefSchema = z.object({
  email: z.string().email('Invalid email format'),
  brain_id: z.string().min(1, 'Brain ID is required'),
  meeting_time: z.string().optional(), // ISO timestamp
  force_regenerate: z.boolean().default(false),
});

// Agent webhook endpoints
const LEAD_SCORER_URL = process.env.LEAD_SCORER_URL;
const MEETING_PREP_URL = process.env.MEETING_PREP_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

/**
 * POST /api/actions/score-lead
 * Manually trigger lead scoring for a specific email
 */
actions.post('/score-lead', zValidator('json', ScoreLeadSchema), async (c) => {
  try {
    const { email, brain_id, force_rescore } = c.req.valid('json');

    // Call Lead Scorer webhook
    const response = await fetch(`${LEAD_SCORER_URL}/webhook/score-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WEBHOOK_SECRET && { 'X-Webhook-Secret': WEBHOOK_SECRET }),
      },
      body: JSON.stringify({
        email,
        brain_id,
        force_rescore,
        source: 'dashboard_manual_trigger',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lead Scorer webhook error:', errorText);
      return c.json(
        {
          success: false,
          error: 'Failed to trigger lead scoring',
          details: errorText,
          code: 'LEAD_SCORER_ERROR',
        },
        response.status === 404 ? 404 : 500
      );
    }

    const result = await response.json();

    return c.json({
      success: true,
      message: `Lead scoring triggered for ${email}`,
      data: result,
    });
  } catch (error) {
    console.error('Error triggering lead scoring:', error);

    // Check if it's a connection error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return c.json(
        {
          success: false,
          error: 'Lead Scorer agent is not reachable',
          code: 'AGENT_UNREACHABLE',
        },
        503
      );
    }

    return c.json(
      {
        success: false,
        error: 'Failed to trigger lead scoring',
        code: 'ACTION_ERROR',
      },
      500
    );
  }
});

/**
 * POST /api/actions/generate-brief
 * Manually trigger meeting brief generation
 */
actions.post('/generate-brief', zValidator('json', GenerateBriefSchema), async (c) => {
  try {
    const { email, brain_id, meeting_time, force_regenerate } = c.req.valid('json');

    // Call Meeting Prep webhook
    const response = await fetch(`${MEETING_PREP_URL}/webhook/meeting-prep/brief`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WEBHOOK_SECRET && { 'X-Webhook-Secret': WEBHOOK_SECRET }),
      },
      body: JSON.stringify({
        email,
        brain_id,
        meeting_time: meeting_time || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        force_regenerate,
        source: 'dashboard_manual_trigger',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Meeting Prep webhook error:', errorText);
      return c.json(
        {
          success: false,
          error: 'Failed to trigger brief generation',
          details: errorText,
          code: 'MEETING_PREP_ERROR',
        },
        response.status === 404 ? 404 : 500
      );
    }

    const result = await response.json();

    return c.json({
      success: true,
      message: `Meeting brief generation triggered for ${email}`,
      data: result,
    });
  } catch (error) {
    console.error('Error triggering brief generation:', error);

    // Check if it's a connection error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return c.json(
        {
          success: false,
          error: 'Meeting Prep agent is not reachable',
          code: 'AGENT_UNREACHABLE',
        },
        503
      );
    }

    return c.json(
      {
        success: false,
        error: 'Failed to trigger brief generation',
        code: 'ACTION_ERROR',
      },
      500
    );
  }
});

/**
 * GET /api/actions/status/:action_id
 * Check status of a triggered action (for polling)
 */
actions.get('/status/:action_id', async (c) => {
  const actionId = c.req.param('action_id');

  // For now, return a placeholder - real implementation would check Redis
  // or the agent's state file for the action status
  return c.json({
    success: true,
    data: {
      action_id: actionId,
      status: 'completed', // pending, processing, completed, failed
      result: null,
      timestamp: new Date().toISOString(),
    },
  });
});

export { actions };
export default actions;
