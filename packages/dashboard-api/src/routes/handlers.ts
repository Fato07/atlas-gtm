/**
 * Objection Handlers API routes
 * Handles CRUD operations for objection handlers
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  CreateHandlerRequestSchema,
  UpdateHandlerRequestSchema,
  ListHandlersParamsSchema,
  TestMatchHandlerRequestSchema,
} from '../contracts';
import {
  listHandlers,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
  testMatchHandlers,
  getHandlersByType,
  OBJECTION_TYPE_DISPLAY_NAMES,
  OBJECTION_TYPE_DESCRIPTIONS,
} from '../services/handlers';

const handlers = new Hono();

// List handlers for a brain
handlers.get(
  '/',
  zValidator(
    'query',
    ListHandlersParamsSchema.extend({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    })
  ),
  async (c) => {
    const brainId = c.req.param('brain_id') as string;
    const params = c.req.valid('query');

    try {
      const result = await listHandlers(brainId, params);
      return c.json({
        success: true,
        handlers: result.handlers,
        total: result.total,
      });
    } catch (error) {
      console.error('Failed to list handlers:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to list handlers',
        },
        500
      );
    }
  }
);

// Get objection types metadata
handlers.get('/types', async (c) => {
  const types = Object.entries(OBJECTION_TYPE_DISPLAY_NAMES).map(([type, displayName]) => ({
    type,
    display_name: displayName,
    description: OBJECTION_TYPE_DESCRIPTIONS[type as keyof typeof OBJECTION_TYPE_DESCRIPTIONS],
  }));

  return c.json({
    success: true,
    types,
  });
});

// Get handlers grouped by type
handlers.get('/by-type', async (c) => {
  const brainId = c.req.param('brain_id') as string;

  try {
    const grouped = await getHandlersByType(brainId);
    return c.json({
      success: true,
      handlers_by_type: grouped,
    });
  } catch (error) {
    console.error('Failed to get handlers by type:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to get handlers by type',
      },
      500
    );
  }
});

// Test match objection text against handlers
handlers.post(
  '/test-match',
  zValidator('json', TestMatchHandlerRequestSchema),
  async (c) => {
    const brainId = c.req.param('brain_id') as string;
    const { objection_text, limit } = c.req.valid('json');

    try {
      const result = await testMatchHandlers(brainId, objection_text, limit);
      return c.json({
        success: true,
        matches: result.matches,
      });
    } catch (error) {
      console.error('Failed to test match handlers:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to test match handlers',
        },
        500
      );
    }
  }
);

// Get a single handler
handlers.get('/:handler_id', async (c) => {
  const brainId = c.req.param('brain_id') as string;
  const handlerId = c.req.param('handler_id') as string;

  try {
    const handler = await getHandler(brainId, handlerId);
    if (!handler) {
      return c.json(
        {
          success: false,
          error: 'Handler not found',
        },
        404
      );
    }
    return c.json({
      success: true,
      handler,
    });
  } catch (error) {
    console.error('Failed to get handler:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to get handler',
      },
      500
    );
  }
});

// Create a new handler
handlers.post(
  '/',
  zValidator('json', CreateHandlerRequestSchema),
  async (c) => {
    const brainId = c.req.param('brain_id') as string;
    const data = c.req.valid('json');

    try {
      const handler = await createHandler(brainId, data);
      return c.json(
        {
          success: true,
          handler,
        },
        201
      );
    } catch (error) {
      console.error('Failed to create handler:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to create handler',
        },
        500
      );
    }
  }
);

// Update a handler
handlers.put(
  '/:handler_id',
  zValidator('json', UpdateHandlerRequestSchema),
  async (c) => {
    const brainId = c.req.param('brain_id') as string;
    const handlerId = c.req.param('handler_id') as string;
    const data = c.req.valid('json');

    try {
      const handler = await updateHandler(brainId, handlerId, data);
      if (!handler) {
        return c.json(
          {
            success: false,
            error: 'Handler not found',
          },
          404
        );
      }
      return c.json({
        success: true,
        handler,
      });
    } catch (error) {
      console.error('Failed to update handler:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to update handler',
        },
        500
      );
    }
  }
);

// Delete a handler
handlers.delete('/:handler_id', async (c) => {
  const brainId = c.req.param('brain_id') as string;
  const handlerId = c.req.param('handler_id') as string;

  try {
    const deleted = await deleteHandler(brainId, handlerId);
    if (!deleted) {
      return c.json(
        {
          success: false,
          error: 'Handler not found',
        },
        404
      );
    }
    return c.json({
      success: true,
      deleted_id: handlerId,
    });
  } catch (error) {
    console.error('Failed to delete handler:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to delete handler',
      },
      500
    );
  }
});

export default handlers;
