/**
 * Pending Items routes
 * REST API endpoints for pending validation management
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  ListPendingParamsSchema,
  ApproveItemRequestSchema,
  RejectItemRequestSchema,
} from '../contracts';
import {
  listPendingItems,
  getPendingItem,
  approvePendingItem,
  rejectPendingItem,
  getPendingCounts,
} from '../services/pending-items';

const pending = new Hono();

/**
 * GET /api/pending
 * List pending items with optional filters
 */
pending.get('/', zValidator('query', ListPendingParamsSchema), async (c) => {
  const params = c.req.valid('query');

  const { items, total } = await listPendingItems(params);

  return c.json({
    success: true,
    items,
    total,
  });
});

/**
 * GET /api/pending/counts
 * Get pending item counts by urgency and type
 */
pending.get('/counts', async (c) => {
  const counts = await getPendingCounts();

  return c.json({
    success: true,
    ...counts,
  });
});

/**
 * GET /api/pending/:item_id
 * Get a single pending item
 */
pending.get('/:item_id', async (c) => {
  const itemId = c.req.param('item_id');

  const item = await getPendingItem(itemId);

  if (!item) {
    return c.json({ success: false, error: 'Pending item not found' }, 404);
  }

  return c.json({
    success: true,
    item,
  });
});

/**
 * POST /api/pending/:item_id/approve
 * Approve a pending item
 */
pending.post(
  '/:item_id/approve',
  zValidator('json', ApproveItemRequestSchema),
  async (c) => {
    const itemId = c.req.param('item_id');
    const { notes } = c.req.valid('json');

    try {
      const result = await approvePendingItem(itemId, notes);
      return c.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Pending item not found') {
        return c.json({ success: false, error: 'Pending item not found' }, 404);
      }
      throw error;
    }
  }
);

/**
 * POST /api/pending/:item_id/reject
 * Reject a pending item
 */
pending.post(
  '/:item_id/reject',
  zValidator('json', RejectItemRequestSchema),
  async (c) => {
    const itemId = c.req.param('item_id');
    const { reason } = c.req.valid('json');

    try {
      const result = await rejectPendingItem(itemId, reason);
      return c.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Pending item not found') {
        return c.json({ success: false, error: 'Pending item not found' }, 404);
      }
      throw error;
    }
  }
);

export default pending;
