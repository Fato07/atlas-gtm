/**
 * Response Templates service
 * Manages template CRUD operations via MCP REST API
 */
import {
  ResponseTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ListTemplatesParams,
  TemplateMetrics,
  ReplyType,
  STANDARD_TEMPLATE_VARIABLES,
} from '../contracts';
import { mcpClient } from './mcp-client';

/**
 * Mock templates data for development (when MCP is unavailable)
 */
function getMockTemplates(): ResponseTemplate[] {
  const now = new Date().toISOString();
  return [
    {
      id: '660e8400-e29b-41d4-a716-446655440001',
      brain_id: 'brain_fintech_demo',
      reply_type: 'positive_interest',
      tier: 1,
      template_text: `Hi {{first_name}},

Great to hear you're interested! I'd love to show you how we're helping companies like {{company_name}} streamline their operations.

Would you have 15 minutes this week for a quick call?

Best,
{{sender_name}}`,
      variables: ['first_name', 'company_name', 'sender_name'],
      personalization: {},
      metrics: {
        times_used: 156,
        reply_rate: 0.42,
        positive_rate: 0.78,
        last_used: '2024-01-20T14:30:00Z',
      },
      created_at: '2024-01-10T09:00:00Z',
      updated_at: now,
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440002',
      brain_id: 'brain_fintech_demo',
      reply_type: 'question',
      tier: 1,
      template_text: `Hi {{first_name}},

Great question! {{custom_answer}}

Happy to jump on a quick call if you'd like to discuss further. Here's my calendar: {{calendar_link}}

Best,
{{sender_name}}`,
      variables: ['first_name', 'custom_answer', 'calendar_link', 'sender_name'],
      personalization: {},
      metrics: {
        times_used: 89,
        reply_rate: 0.38,
        positive_rate: 0.65,
        last_used: '2024-01-19T11:00:00Z',
      },
      created_at: '2024-01-11T10:00:00Z',
      updated_at: now,
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440003',
      brain_id: 'brain_fintech_demo',
      reply_type: 'objection',
      tier: 2,
      template_text: `Hi {{first_name}},

I completely understand - {{objection_acknowledgment}}

Many of our clients at companies similar to {{company_name}} had the same concern initially. What we found is {{value_proposition}}.

Would a quick 10-minute call to walk through how this works be helpful?

Best,
{{sender_name}}`,
      variables: ['first_name', 'objection_acknowledgment', 'company_name', 'value_proposition', 'sender_name'],
      personalization: {},
      metrics: {
        times_used: 45,
        reply_rate: 0.28,
        positive_rate: 0.52,
        last_used: '2024-01-18T16:00:00Z',
      },
      created_at: '2024-01-12T14:00:00Z',
      updated_at: now,
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440004',
      brain_id: 'brain_fintech_demo',
      reply_type: 'not_interested',
      tier: 3,
      template_text: `Hi {{first_name}},

Thanks for letting me know. I appreciate your directness.

If anything changes or you'd like to explore this in the future, feel free to reach out.

All the best,
{{sender_name}}`,
      variables: ['first_name', 'sender_name'],
      personalization: {},
      metrics: {
        times_used: 67,
        reply_rate: 0.08,
        positive_rate: 0.15,
        last_used: '2024-01-17T09:30:00Z',
      },
      created_at: '2024-01-13T11:00:00Z',
      updated_at: now,
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440005',
      brain_id: 'brain_fintech_demo',
      reply_type: 'out_of_office',
      tier: 1,
      template_text: `Hi {{first_name}},

Thanks for the heads up! I'll follow up when you're back on {{return_date}}.

Safe travels!

Best,
{{sender_name}}`,
      variables: ['first_name', 'return_date', 'sender_name'],
      personalization: {},
      metrics: {
        times_used: 23,
        reply_rate: 0.52,
        positive_rate: 0.85,
        last_used: '2024-01-16T08:00:00Z',
      },
      created_at: '2024-01-14T15:00:00Z',
      updated_at: now,
    },
    // SaaS brain templates
    {
      id: '660e8400-e29b-41d4-a716-446655440006',
      brain_id: 'brain_saas_demo',
      reply_type: 'positive_interest',
      tier: 1,
      template_text: `Hey {{first_name}}!

Awesome to hear from you! I'd love to give you a quick demo of how we can help {{company_name}} scale faster.

Does {{meeting_link}} work for a 20-min chat?

Cheers,
{{sender_name}}`,
      variables: ['first_name', 'company_name', 'meeting_link', 'sender_name'],
      personalization: {},
      metrics: {
        times_used: 78,
        reply_rate: 0.45,
        positive_rate: 0.72,
        last_used: '2024-01-21T10:00:00Z',
      },
      created_at: '2024-02-01T09:00:00Z',
      updated_at: now,
    },
  ];
}

// In-memory store for development
let mockTemplatesStore: ResponseTemplate[] = getMockTemplates();

/**
 * Extract variables from template text
 */
export function extractVariables(templateText: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(templateText)) !== null) {
    const variable = match[1];
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }

  return variables;
}

/**
 * Preview a template with sample data
 */
export function previewTemplate(
  templateText: string,
  sampleData?: Record<string, string>
): { preview: string; detected_variables: string[] } {
  const detectedVariables = extractVariables(templateText);

  // Default sample data for standard variables
  const defaultSampleData: Record<string, string> = {
    first_name: 'John',
    last_name: 'Smith',
    company_name: 'Acme Corp',
    title: 'VP of Engineering',
    industry: 'Technology',
    company_size: '51-200',
    location: 'San Francisco, CA',
    sender_name: 'Sarah',
    sender_title: 'Account Executive',
    meeting_link: 'https://calendly.com/sarah/intro',
    calendar_link: 'https://calendly.com/sarah/intro',
    custom_answer: '[Your answer here]',
    objection_acknowledgment: '[Acknowledgment here]',
    value_proposition: '[Value proposition here]',
    return_date: 'January 28th',
  };

  // Merge with provided sample data
  const mergedData = { ...defaultSampleData, ...sampleData };

  // Replace variables in template
  let preview = templateText;
  for (const variable of detectedVariables) {
    const value = mergedData[variable] || `{{${variable}}}`;
    preview = preview.replace(new RegExp(`\\{\\{${variable}\\}\\}`, 'g'), value);
  }

  return { preview, detected_variables: detectedVariables };
}

/**
 * List templates for a brain with optional filtering
 */
export async function listTemplates(
  brainId: string,
  params?: ListTemplatesParams
): Promise<{ templates: ResponseTemplate[]; total: number }> {
  try {
    // Try MCP first
    const response = await mcpClient.listTemplates(brainId, params?.reply_type);
    if (response.success && response.result && Array.isArray(response.result)) {
      let templates = response.result as ResponseTemplate[];

      // Apply additional filters
      if (params?.tier !== undefined) {
        templates = templates.filter(t => t.tier === params.tier);
      }

      return { templates, total: templates.length };
    }
  } catch {
    console.warn('MCP unavailable, using mock templates data');
  }

  // Use mock data
  let templates = mockTemplatesStore.filter(t => t.brain_id === brainId);

  // Apply filters
  if (params?.reply_type) {
    templates = templates.filter(t => t.reply_type === params.reply_type);
  }
  if (params?.tier !== undefined) {
    templates = templates.filter(t => t.tier === params.tier);
  }

  return { templates, total: templates.length };
}

/**
 * Get a single template by ID
 */
export async function getTemplate(
  brainId: string,
  templateId: string
): Promise<ResponseTemplate | null> {
  try {
    const response = await mcpClient.getTemplate(brainId, templateId);
    if (response.success && response.result) {
      return response.result as ResponseTemplate;
    }
  } catch {
    console.warn('MCP unavailable, using mock templates data');
  }

  // Use mock data
  return (
    mockTemplatesStore.find(t => t.id === templateId && t.brain_id === brainId) ||
    null
  );
}

/**
 * Create a new template
 */
export async function createTemplate(
  brainId: string,
  data: CreateTemplateRequest
): Promise<ResponseTemplate> {
  const now = new Date().toISOString();
  const templateId = crypto.randomUUID();

  // Extract variables from template text
  const variables = data.variables || extractVariables(data.template_text);

  const newTemplate: ResponseTemplate = {
    id: templateId,
    brain_id: brainId,
    reply_type: data.reply_type,
    tier: data.tier,
    template_text: data.template_text,
    variables,
    personalization: data.personalization || {},
    metrics: null,
    created_at: now,
    updated_at: now,
  };

  try {
    const response = await mcpClient.createTemplate(brainId, data);
    if (response.success && response.result) {
      return response.result as ResponseTemplate;
    }
  } catch {
    console.warn('MCP unavailable, using mock templates store');
  }

  // Add to mock store
  mockTemplatesStore.push(newTemplate);
  return newTemplate;
}

/**
 * Update a template
 */
export async function updateTemplate(
  brainId: string,
  templateId: string,
  data: UpdateTemplateRequest
): Promise<ResponseTemplate | null> {
  const now = new Date().toISOString();

  try {
    const response = await mcpClient.updateTemplate(brainId, templateId, data);
    if (response.success && response.result) {
      return response.result as ResponseTemplate;
    }
  } catch {
    console.warn('MCP unavailable, using mock templates store');
  }

  // Update in mock store
  const index = mockTemplatesStore.findIndex(
    t => t.id === templateId && t.brain_id === brainId
  );
  if (index === -1) return null;

  const existing = mockTemplatesStore[index];

  // Re-extract variables if template_text changed
  const variables =
    data.template_text !== undefined
      ? data.variables || extractVariables(data.template_text)
      : data.variables || existing.variables;

  const updated: ResponseTemplate = {
    ...existing,
    reply_type: data.reply_type ?? existing.reply_type,
    tier: data.tier ?? existing.tier,
    template_text: data.template_text ?? existing.template_text,
    variables,
    personalization: data.personalization ?? existing.personalization,
    updated_at: now,
  };

  mockTemplatesStore[index] = updated;
  return updated;
}

/**
 * Delete a template
 */
export async function deleteTemplate(
  brainId: string,
  templateId: string
): Promise<boolean> {
  try {
    const response = await mcpClient.deleteTemplate(brainId, templateId);
    if (response.success) {
      return true;
    }
  } catch {
    console.warn('MCP unavailable, using mock templates store');
  }

  // Delete from mock store
  const index = mockTemplatesStore.findIndex(
    t => t.id === templateId && t.brain_id === brainId
  );
  if (index === -1) return false;

  mockTemplatesStore.splice(index, 1);
  return true;
}

/**
 * Get templates count for a brain
 */
export async function getTemplatesCount(brainId: string): Promise<number> {
  const { total } = await listTemplates(brainId);
  return total;
}

/**
 * Get templates grouped by reply type
 */
export async function getTemplatesByReplyType(
  brainId: string
): Promise<Record<ReplyType, ResponseTemplate[]>> {
  const { templates } = await listTemplates(brainId);

  const grouped: Record<ReplyType, ResponseTemplate[]> = {
    positive_interest: [],
    question: [],
    objection: [],
    not_interested: [],
    out_of_office: [],
    other: [],
  };

  for (const template of templates) {
    grouped[template.reply_type].push(template);
  }

  return grouped;
}

/**
 * Get standard template variables
 */
export function getStandardVariables(): readonly string[] {
  return STANDARD_TEMPLATE_VARIABLES;
}
