/**
 * ICP Rules routes
 * CRUD operations for ICP scoring rules within a brain
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  CreateICPRuleRequestSchema,
  UpdateICPRuleRequestSchema,
  ListICPRulesParamsSchema,
  BulkImportICPRulesRequestSchema,
} from '../contracts';
import {
  listICPRules,
  getICPRule,
  createICPRule,
  updateICPRule,
  deleteICPRule,
  bulkImportICPRules,
} from '../services/icp-rules';
import { createLogger } from '../middleware/logging';

const icpRules = new Hono();

// Param schemas
const brainIdParamSchema = z.object({
  brain_id: z.string(),
});

const ruleIdParamSchema = z.object({
  brain_id: z.string(),
  rule_id: z.string().uuid(),
});

/**
 * GET /api/brains/:brain_id/icp-rules
 * List all ICP rules for a brain with optional filtering
 */
icpRules.get(
  '/',
  zValidator('param', brainIdParamSchema),
  zValidator('query', ListICPRulesParamsSchema),
  async (c) => {
    const logger = createLogger(c);
    const { brain_id } = c.req.valid('param');
    const params = c.req.valid('query');

    try {
      logger.info('icp_rules_list_requested', { brain_id, params });

      const { rules, total } = await listICPRules(brain_id, params);

      logger.info('icp_rules_list_returned', { brain_id, count: rules.length });

      return c.json({
        success: true,
        rules,
        total,
      });
    } catch (error) {
      logger.error('icp_rules_list_error', error instanceof Error ? error : 'Unknown error', {
        brain_id,
      });

      return c.json(
        {
          success: false,
          error: 'Failed to fetch ICP rules',
          code: 'ICP_RULES_LIST_ERROR',
        },
        500
      );
    }
  }
);

/**
 * GET /api/brains/:brain_id/icp-rules/:rule_id
 * Get a single ICP rule by ID
 */
icpRules.get(
  '/:rule_id',
  zValidator('param', ruleIdParamSchema),
  async (c) => {
    const logger = createLogger(c);
    const { brain_id, rule_id } = c.req.valid('param');

    try {
      logger.info('icp_rule_get_requested', { brain_id, rule_id });

      const rule = await getICPRule(brain_id, rule_id);

      if (!rule) {
        return c.json(
          {
            success: false,
            error: `ICP rule not found: ${rule_id}`,
            code: 'ICP_RULE_NOT_FOUND',
          },
          404
        );
      }

      logger.info('icp_rule_get_returned', { brain_id, rule_id });

      return c.json({
        success: true,
        rule,
      });
    } catch (error) {
      logger.error('icp_rule_get_error', error instanceof Error ? error : 'Unknown error', {
        brain_id,
        rule_id,
      });

      return c.json(
        {
          success: false,
          error: 'Failed to fetch ICP rule',
          code: 'ICP_RULE_GET_ERROR',
        },
        500
      );
    }
  }
);

/**
 * POST /api/brains/:brain_id/icp-rules
 * Create a new ICP rule
 */
icpRules.post(
  '/',
  zValidator('param', brainIdParamSchema),
  zValidator('json', CreateICPRuleRequestSchema),
  async (c) => {
    const logger = createLogger(c);
    const { brain_id } = c.req.valid('param');
    const data = c.req.valid('json');

    try {
      logger.info('icp_rule_create_requested', {
        brain_id,
        category: data.category,
        attribute: data.attribute,
      });

      const rule = await createICPRule(brain_id, data);

      logger.info('icp_rule_created', { brain_id, rule_id: rule.id });

      return c.json(
        {
          success: true,
          rule,
        },
        201
      );
    } catch (error) {
      logger.error('icp_rule_create_error', error instanceof Error ? error : 'Unknown error', {
        brain_id,
      });

      return c.json(
        {
          success: false,
          error: 'Failed to create ICP rule',
          code: 'ICP_RULE_CREATE_ERROR',
        },
        500
      );
    }
  }
);

/**
 * PUT /api/brains/:brain_id/icp-rules/:rule_id
 * Update an ICP rule
 */
icpRules.put(
  '/:rule_id',
  zValidator('param', ruleIdParamSchema),
  zValidator('json', UpdateICPRuleRequestSchema),
  async (c) => {
    const logger = createLogger(c);
    const { brain_id, rule_id } = c.req.valid('param');
    const data = c.req.valid('json');

    try {
      logger.info('icp_rule_update_requested', { brain_id, rule_id, updates: data });

      const rule = await updateICPRule(brain_id, rule_id, data);

      if (!rule) {
        return c.json(
          {
            success: false,
            error: `ICP rule not found: ${rule_id}`,
            code: 'ICP_RULE_NOT_FOUND',
          },
          404
        );
      }

      logger.info('icp_rule_updated', { brain_id, rule_id });

      return c.json({
        success: true,
        rule,
      });
    } catch (error) {
      logger.error('icp_rule_update_error', error instanceof Error ? error : 'Unknown error', {
        brain_id,
        rule_id,
      });

      return c.json(
        {
          success: false,
          error: 'Failed to update ICP rule',
          code: 'ICP_RULE_UPDATE_ERROR',
        },
        500
      );
    }
  }
);

/**
 * DELETE /api/brains/:brain_id/icp-rules/:rule_id
 * Delete an ICP rule
 */
icpRules.delete(
  '/:rule_id',
  zValidator('param', ruleIdParamSchema),
  async (c) => {
    const logger = createLogger(c);
    const { brain_id, rule_id } = c.req.valid('param');

    try {
      logger.info('icp_rule_delete_requested', { brain_id, rule_id });

      const deleted = await deleteICPRule(brain_id, rule_id);

      if (!deleted) {
        return c.json(
          {
            success: false,
            error: `ICP rule not found: ${rule_id}`,
            code: 'ICP_RULE_NOT_FOUND',
          },
          404
        );
      }

      logger.info('icp_rule_deleted', { brain_id, rule_id });

      return c.json({
        success: true,
        deleted_id: rule_id,
      });
    } catch (error) {
      logger.error('icp_rule_delete_error', error instanceof Error ? error : 'Unknown error', {
        brain_id,
        rule_id,
      });

      return c.json(
        {
          success: false,
          error: 'Failed to delete ICP rule',
          code: 'ICP_RULE_DELETE_ERROR',
        },
        500
      );
    }
  }
);

/**
 * POST /api/brains/:brain_id/icp-rules/import
 * Bulk import ICP rules
 */
icpRules.post(
  '/import',
  zValidator('param', brainIdParamSchema),
  zValidator('json', BulkImportICPRulesRequestSchema),
  async (c) => {
    const logger = createLogger(c);
    const { brain_id } = c.req.valid('param');
    const data = c.req.valid('json');

    try {
      logger.info('icp_rules_import_requested', {
        brain_id,
        rules_count: data.rules.length,
        replace_existing: data.replace_existing,
      });

      const result = await bulkImportICPRules(brain_id, data);

      logger.info('icp_rules_imported', {
        brain_id,
        imported: result.imported,
        skipped: result.skipped,
        errors_count: result.errors.length,
      });

      return c.json({
        success: true,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
      });
    } catch (error) {
      logger.error('icp_rules_import_error', error instanceof Error ? error : 'Unknown error', {
        brain_id,
      });

      return c.json(
        {
          success: false,
          error: 'Failed to import ICP rules',
          code: 'ICP_RULES_IMPORT_ERROR',
        },
        500
      );
    }
  }
);

export { icpRules };
