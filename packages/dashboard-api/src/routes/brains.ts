/**
 * Brain routes
 * CRUD operations for brain management
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  CreateBrainRequestSchema,
  UpdateBrainRequestSchema,
  ListBrainsParamsSchema,
} from '../contracts';
import {
  listBrains,
  getBrain,
  createBrain,
  updateBrain,
  activateBrain,
  archiveBrain,
  cloneBrain,
  isBrainNameUnique,
} from '../services/brains';
import { createLogger } from '../middleware/logging';

const brains = new Hono();

/**
 * GET /api/brains
 * List all brains with optional filtering
 */
brains.get(
  '/',
  zValidator('query', ListBrainsParamsSchema),
  async (c) => {
    const logger = createLogger(c);
    const params = c.req.valid('query');

    try {
      logger.info('brains_list_requested', { params });

      const brainList = await listBrains(params);

      logger.info('brains_list_returned', { count: brainList.length });

      return c.json({
        success: true,
        brains: brainList,
      });
    } catch (error) {
      logger.error('brains_list_error', error instanceof Error ? error : 'Unknown error');

      return c.json(
        {
          success: false,
          error: 'Failed to fetch brains',
          code: 'BRAINS_LIST_ERROR',
        },
        500
      );
    }
  }
);

// Brain ID param schema
const brainIdParamSchema = z.object({
  brain_id: z.string(),
});

/**
 * GET /api/brains/:brain_id
 * Get a single brain by ID
 */
brains.get(
  '/:brain_id',
  zValidator('param', brainIdParamSchema),
  async (c) => {
    const logger = createLogger(c);
    const { brain_id } = c.req.valid('param');

    try {
      logger.info('brain_get_requested', { brain_id });

      const brain = await getBrain(brain_id);

      if (!brain) {
        return c.json(
          {
            success: false,
            error: `Brain not found: ${brain_id}`,
            code: 'BRAIN_NOT_FOUND',
          },
          404
        );
      }

      logger.info('brain_get_returned', { brain_id });

      return c.json({
        success: true,
        brain,
      });
    } catch (error) {
      logger.error('brain_get_error', error instanceof Error ? error : 'Unknown error', {
        brain_id,
      });

      return c.json(
        {
          success: false,
          error: 'Failed to fetch brain',
          code: 'BRAIN_GET_ERROR',
        },
        500
      );
    }
  }
);

/**
 * POST /api/brains
 * Create a new brain
 */
brains.post(
  '/',
  zValidator('json', CreateBrainRequestSchema),
  async (c) => {
    const logger = createLogger(c);
    const data = c.req.valid('json');

    try {
      logger.info('brain_create_requested', { name: data.name, vertical: data.vertical });

      // Check name uniqueness
      const isUnique = await isBrainNameUnique(data.name);
      if (!isUnique) {
        return c.json(
          {
            success: false,
            error: `A brain with name "${data.name}" already exists`,
            code: 'BRAIN_NAME_EXISTS',
          },
          400
        );
      }

      const brain = await createBrain(data);

      logger.info('brain_created', { brain_id: brain.brain_id });

      return c.json(
        {
          success: true,
          brain,
        },
        201
      );
    } catch (error) {
      logger.error('brain_create_error', error instanceof Error ? error : 'Unknown error');

      return c.json(
        {
          success: false,
          error: 'Failed to create brain',
          code: 'BRAIN_CREATE_ERROR',
        },
        500
      );
    }
  }
);

/**
 * PUT /api/brains/:brain_id
 * Update a brain
 */
brains.put(
  '/:brain_id',
  zValidator('param', brainIdParamSchema),
  zValidator('json', UpdateBrainRequestSchema),
  async (c) => {
    const logger = createLogger(c);
    const { brain_id } = c.req.valid('param');
    const data = c.req.valid('json');

    try {
      logger.info('brain_update_requested', { brain_id, updates: data });

      // Check name uniqueness if name is being changed
      if (data.name) {
        const isUnique = await isBrainNameUnique(data.name, brain_id);
        if (!isUnique) {
          return c.json(
            {
              success: false,
              error: `A brain with name "${data.name}" already exists`,
              code: 'BRAIN_NAME_EXISTS',
            },
            400
          );
        }
      }

      const brain = await updateBrain(brain_id, data);

      if (!brain) {
        return c.json(
          {
            success: false,
            error: `Brain not found: ${brain_id}`,
            code: 'BRAIN_NOT_FOUND',
          },
          404
        );
      }

      logger.info('brain_updated', { brain_id });

      return c.json({
        success: true,
        brain,
      });
    } catch (error) {
      logger.error('brain_update_error', error instanceof Error ? error : 'Unknown error', {
        brain_id,
      });

      return c.json(
        {
          success: false,
          error: 'Failed to update brain',
          code: 'BRAIN_UPDATE_ERROR',
        },
        500
      );
    }
  }
);

/**
 * POST /api/brains/:brain_id/activate
 * Activate a brain (archives currently active brain of same vertical)
 */
brains.post(
  '/:brain_id/activate',
  zValidator('param', brainIdParamSchema),
  async (c) => {
    const logger = createLogger(c);
    const { brain_id } = c.req.valid('param');

    try {
      logger.info('brain_activate_requested', { brain_id });

      const result = await activateBrain(brain_id);

      logger.info('brain_activated', {
        brain_id,
        archived_brain_id: result.archived_brain_id,
      });

      return c.json({
        success: true,
        brain: result.brain,
        archived_brain_id: result.archived_brain_id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('not found')) {
        return c.json(
          {
            success: false,
            error: message,
            code: 'BRAIN_NOT_FOUND',
          },
          404
        );
      }

      logger.error('brain_activate_error', error instanceof Error ? error : 'Unknown error', {
        brain_id,
      });

      return c.json(
        {
          success: false,
          error: 'Failed to activate brain',
          code: 'BRAIN_ACTIVATE_ERROR',
        },
        500
      );
    }
  }
);

/**
 * POST /api/brains/:brain_id/archive
 * Archive a brain
 */
brains.post(
  '/:brain_id/archive',
  zValidator('param', brainIdParamSchema),
  async (c) => {
    const logger = createLogger(c);
    const { brain_id } = c.req.valid('param');

    try {
      logger.info('brain_archive_requested', { brain_id });

      const brain = await archiveBrain(brain_id);

      if (!brain) {
        return c.json(
          {
            success: false,
            error: `Brain not found: ${brain_id}`,
            code: 'BRAIN_NOT_FOUND',
          },
          404
        );
      }

      logger.info('brain_archived', { brain_id });

      return c.json({
        success: true,
        brain,
      });
    } catch (error) {
      logger.error('brain_archive_error', error instanceof Error ? error : 'Unknown error', {
        brain_id,
      });

      return c.json(
        {
          success: false,
          error: 'Failed to archive brain',
          code: 'BRAIN_ARCHIVE_ERROR',
        },
        500
      );
    }
  }
);

// Clone request schema
const cloneBrainRequestSchema = z.object({
  name: z.string().min(1).max(100),
});

/**
 * POST /api/brains/:brain_id/clone
 * Clone a brain
 */
brains.post(
  '/:brain_id/clone',
  zValidator('param', brainIdParamSchema),
  zValidator('json', cloneBrainRequestSchema),
  async (c) => {
    const logger = createLogger(c);
    const { brain_id } = c.req.valid('param');
    const { name } = c.req.valid('json');

    try {
      logger.info('brain_clone_requested', { source_brain_id: brain_id, new_name: name });

      // Check name uniqueness
      const isUnique = await isBrainNameUnique(name);
      if (!isUnique) {
        return c.json(
          {
            success: false,
            error: `A brain with name "${name}" already exists`,
            code: 'BRAIN_NAME_EXISTS',
          },
          400
        );
      }

      const brain = await cloneBrain(brain_id, name);

      logger.info('brain_cloned', {
        source_brain_id: brain_id,
        new_brain_id: brain.brain_id,
      });

      return c.json(
        {
          success: true,
          brain,
        },
        201
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('not found')) {
        return c.json(
          {
            success: false,
            error: message,
            code: 'BRAIN_NOT_FOUND',
          },
          404
        );
      }

      logger.error('brain_clone_error', error instanceof Error ? error : 'Unknown error', {
        brain_id,
      });

      return c.json(
        {
          success: false,
          error: 'Failed to clone brain',
          code: 'BRAIN_CLONE_ERROR',
        },
        500
      );
    }
  }
);

export { brains };
