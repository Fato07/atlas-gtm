/**
 * Market Research routes
 * REST API endpoints for research document management
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  CreateResearchRequestSchema,
  UpdateResearchRequestSchema,
  ListResearchParamsSchema,
} from '../contracts';
import {
  listResearch,
  getResearch,
  createResearch,
  updateResearch,
  deleteResearch,
  archiveResearch,
  getResearchTags,
} from '../services/research';

const research = new Hono();

/**
 * GET /api/brains/:brain_id/research
 * List research documents with optional filters
 */
research.get('/', zValidator('query', ListResearchParamsSchema), async (c) => {
  const brainId = c.req.param('brain_id') as string;
  const params = c.req.valid('query');

  const { documents, total } = await listResearch(brainId, params);

  return c.json({
    success: true,
    documents,
    total,
  });
});

/**
 * GET /api/brains/:brain_id/research/tags
 * Get all unique tags for a brain's research
 */
research.get('/tags', async (c) => {
  const brainId = c.req.param('brain_id') as string;

  const tags = await getResearchTags(brainId);

  return c.json({
    success: true,
    tags,
  });
});

/**
 * GET /api/brains/:brain_id/research/:doc_id
 * Get a single research document
 */
research.get('/:doc_id', async (c) => {
  const brainId = c.req.param('brain_id') as string;
  const docId = c.req.param('doc_id') as string;

  const document = await getResearch(brainId, docId);

  if (!document) {
    return c.json(
      { success: false, error: 'Research document not found' },
      404
    );
  }

  return c.json({
    success: true,
    document,
  });
});

/**
 * POST /api/brains/:brain_id/research
 * Create a new research document
 */
research.post('/', zValidator('json', CreateResearchRequestSchema), async (c) => {
  const brainId = c.req.param('brain_id') as string;
  const data = c.req.valid('json');

  const document = await createResearch(brainId, data);

  return c.json(
    {
      success: true,
      document,
      extracted_facts_count: document.key_facts.length,
    },
    201
  );
});

/**
 * PATCH /api/brains/:brain_id/research/:doc_id
 * Update a research document
 */
research.patch(
  '/:doc_id',
  zValidator('json', UpdateResearchRequestSchema),
  async (c) => {
    const brainId = c.req.param('brain_id') as string;
    const docId = c.req.param('doc_id') as string;
    const data = c.req.valid('json');

    const document = await updateResearch(brainId, docId, data);

    if (!document) {
      return c.json(
        { success: false, error: 'Research document not found' },
        404
      );
    }

    return c.json({
      success: true,
      document,
    });
  }
);

/**
 * POST /api/brains/:brain_id/research/:doc_id/archive
 * Archive a research document
 */
research.post('/:doc_id/archive', async (c) => {
  const brainId = c.req.param('brain_id') as string;
  const docId = c.req.param('doc_id') as string;

  const document = await archiveResearch(brainId, docId);

  if (!document) {
    return c.json(
      { success: false, error: 'Research document not found' },
      404
    );
  }

  return c.json({
    success: true,
    document,
  });
});

/**
 * DELETE /api/brains/:brain_id/research/:doc_id
 * Delete a research document
 */
research.delete('/:doc_id', async (c) => {
  const brainId = c.req.param('brain_id') as string;
  const docId = c.req.param('doc_id') as string;

  const deleted = await deleteResearch(brainId, docId);

  if (!deleted) {
    return c.json(
      { success: false, error: 'Research document not found' },
      404
    );
  }

  return c.json({
    success: true,
    deleted_id: docId,
  });
});

export default research;
