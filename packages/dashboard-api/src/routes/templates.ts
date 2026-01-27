/**
 * Response Templates API routes
 * Handles CRUD operations for response templates
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  CreateTemplateRequestSchema,
  UpdateTemplateRequestSchema,
  ListTemplatesParamsSchema,
  PreviewTemplateRequestSchema,
} from '../contracts';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  getStandardVariables,
} from '../services/templates';

const templates = new Hono();

// List templates for a brain
templates.get(
  '/',
  zValidator(
    'query',
    ListTemplatesParamsSchema.extend({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    })
  ),
  async (c) => {
    const brainId = c.req.param('brain_id') as string;
    const params = c.req.valid('query');

    try {
      const result = await listTemplates(brainId, params);
      return c.json({
        success: true,
        templates: result.templates,
        total: result.total,
      });
    } catch (error) {
      console.error('Failed to list templates:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to list templates',
        },
        500
      );
    }
  }
);

// Get standard variables
templates.get('/variables', async (c) => {
  const variables = getStandardVariables();
  return c.json({
    success: true,
    variables,
  });
});

// Get a single template
templates.get('/:template_id', async (c) => {
  const brainId = c.req.param('brain_id') as string;
  const templateId = c.req.param('template_id') as string;

  try {
    const template = await getTemplate(brainId, templateId);
    if (!template) {
      return c.json(
        {
          success: false,
          error: 'Template not found',
        },
        404
      );
    }
    return c.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('Failed to get template:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to get template',
      },
      500
    );
  }
});

// Create a new template
templates.post(
  '/',
  zValidator('json', CreateTemplateRequestSchema),
  async (c) => {
    const brainId = c.req.param('brain_id') as string;
    const data = c.req.valid('json');

    try {
      const template = await createTemplate(brainId, data);
      return c.json(
        {
          success: true,
          template,
        },
        201
      );
    } catch (error) {
      console.error('Failed to create template:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to create template',
        },
        500
      );
    }
  }
);

// Update a template
templates.put(
  '/:template_id',
  zValidator('json', UpdateTemplateRequestSchema),
  async (c) => {
    const brainId = c.req.param('brain_id') as string;
    const templateId = c.req.param('template_id') as string;
    const data = c.req.valid('json');

    try {
      const template = await updateTemplate(brainId, templateId, data);
      if (!template) {
        return c.json(
          {
            success: false,
            error: 'Template not found',
          },
          404
        );
      }
      return c.json({
        success: true,
        template,
      });
    } catch (error) {
      console.error('Failed to update template:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to update template',
        },
        500
      );
    }
  }
);

// Delete a template
templates.delete('/:template_id', async (c) => {
  const brainId = c.req.param('brain_id') as string;
  const templateId = c.req.param('template_id') as string;

  try {
    const deleted = await deleteTemplate(brainId, templateId);
    if (!deleted) {
      return c.json(
        {
          success: false,
          error: 'Template not found',
        },
        404
      );
    }
    return c.json({
      success: true,
      deleted_id: templateId,
    });
  } catch (error) {
    console.error('Failed to delete template:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to delete template',
      },
      500
    );
  }
});

// Preview a template with sample data
templates.post(
  '/:template_id/preview',
  zValidator('json', PreviewTemplateRequestSchema),
  async (c) => {
    const brainId = c.req.param('brain_id') as string;
    const templateId = c.req.param('template_id') as string;
    const { sample_data } = c.req.valid('json');

    try {
      // Get the template first
      const template = await getTemplate(brainId, templateId);
      if (!template) {
        return c.json(
          {
            success: false,
            error: 'Template not found',
          },
          404
        );
      }

      // Preview with template text
      const result = previewTemplate(template.template_text, sample_data);
      return c.json({
        success: true,
        preview: result.preview,
        detected_variables: result.detected_variables,
      });
    } catch (error) {
      console.error('Failed to preview template:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to preview template',
        },
        500
      );
    }
  }
);

// Preview arbitrary template text (for live preview while editing)
templates.post(
  '/preview',
  zValidator('json', PreviewTemplateRequestSchema),
  async (c) => {
    const { template_text, sample_data } = c.req.valid('json');

    try {
      const result = previewTemplate(template_text, sample_data);
      return c.json({
        success: true,
        preview: result.preview,
        detected_variables: result.detected_variables,
      });
    } catch (error) {
      console.error('Failed to preview template:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to preview template',
        },
        500
      );
    }
  }
);

export default templates;
