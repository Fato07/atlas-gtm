/**
 * ICP Rules service
 * Manages ICP rule CRUD operations via MCP REST API
 */
import {
  ICPRule,
  ICPCategory,
  CreateICPRuleRequest,
  UpdateICPRuleRequest,
  ListICPRulesParams,
  BulkImportICPRulesRequest,
} from '../contracts';
import { mcpClient } from './mcp-client';

/**
 * Mock ICP rules data for development (when MCP is unavailable)
 */
function getMockICPRules(): ICPRule[] {
  const now = new Date().toISOString();
  return [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      brain_id: 'brain_fintech_demo',
      category: 'firmographic',
      attribute: 'company_size',
      display_name: 'Company Size (11-200 employees)',
      condition: {
        operator: 'in',
        value: ['11-50', '51-200'],
      },
      score_weight: 25,
      is_knockout: false,
      reasoning: 'Target companies with enough scale to need our solution',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: now,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      brain_id: 'brain_fintech_demo',
      category: 'firmographic',
      attribute: 'industry',
      display_name: 'FinTech Industry',
      condition: {
        operator: 'contains',
        value: 'fintech',
        case_sensitive: false,
      },
      score_weight: 30,
      is_knockout: true,
      reasoning: 'Must be in FinTech industry for vertical fit',
      created_at: '2024-01-15T10:05:00Z',
      updated_at: now,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      brain_id: 'brain_fintech_demo',
      category: 'technographic',
      attribute: 'tech_stack',
      display_name: 'Uses Modern Tech Stack',
      condition: {
        operator: 'in',
        value: ['React', 'Node.js', 'TypeScript', 'Python'],
      },
      score_weight: 15,
      is_knockout: false,
      reasoning: 'Modern tech stack indicates technical sophistication',
      created_at: '2024-01-16T09:00:00Z',
      updated_at: now,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      brain_id: 'brain_fintech_demo',
      category: 'behavioral',
      attribute: 'funding_stage',
      display_name: 'Series A or Later',
      condition: {
        operator: 'in',
        value: ['Series A', 'Series B', 'Series C'],
      },
      score_weight: 20,
      is_knockout: false,
      reasoning: 'Post-seed funding indicates growth trajectory',
      created_at: '2024-01-17T11:00:00Z',
      updated_at: now,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440005',
      brain_id: 'brain_fintech_demo',
      category: 'engagement',
      attribute: 'email_opens',
      display_name: 'Opened at least 2 emails',
      condition: {
        operator: 'gte',
        value: 2,
      },
      score_weight: 10,
      is_knockout: false,
      reasoning: 'Email engagement signals interest',
      created_at: '2024-01-18T14:00:00Z',
      updated_at: now,
    },
    // SaaS brain rules
    {
      id: '550e8400-e29b-41d4-a716-446655440006',
      brain_id: 'brain_saas_demo',
      category: 'firmographic',
      attribute: 'company_size',
      display_name: 'Early Stage Company (1-50)',
      condition: {
        operator: 'in',
        value: ['1-10', '11-50'],
      },
      score_weight: 20,
      is_knockout: false,
      reasoning: 'Target early-stage companies for SaaS vertical',
      created_at: '2024-02-01T14:30:00Z',
      updated_at: now,
    },
  ];
}

// In-memory store for development
let mockICPRulesStore: ICPRule[] = getMockICPRules();

/**
 * List ICP rules for a brain with optional filtering
 */
export async function listICPRules(
  brainId: string,
  params?: ListICPRulesParams
): Promise<{ rules: ICPRule[]; total: number }> {
  try {
    // Try MCP first
    const response = await mcpClient.listICPRules(brainId, params?.category);
    if (response.success && response.result && Array.isArray(response.result)) {
      let rules = response.result as ICPRule[];

      // Apply additional filters
      if (params?.is_knockout !== undefined) {
        rules = rules.filter(r => r.is_knockout === params.is_knockout);
      }
      if (params?.search) {
        const search = params.search.toLowerCase();
        rules = rules.filter(
          r =>
            r.display_name.toLowerCase().includes(search) ||
            r.attribute.toLowerCase().includes(search)
        );
      }

      return { rules, total: rules.length };
    }
  } catch {
    console.warn('MCP unavailable, using mock ICP rules data');
  }

  // Use mock data
  let rules = mockICPRulesStore.filter(r => r.brain_id === brainId);

  // Apply filters
  if (params?.category) {
    rules = rules.filter(r => r.category === params.category);
  }
  if (params?.is_knockout !== undefined) {
    rules = rules.filter(r => r.is_knockout === params.is_knockout);
  }
  if (params?.search) {
    const search = params.search.toLowerCase();
    rules = rules.filter(
      r =>
        r.display_name.toLowerCase().includes(search) ||
        r.attribute.toLowerCase().includes(search)
    );
  }

  return { rules, total: rules.length };
}

/**
 * Get a single ICP rule by ID
 */
export async function getICPRule(
  brainId: string,
  ruleId: string
): Promise<ICPRule | null> {
  try {
    const response = await mcpClient.getICPRule(brainId, ruleId);
    if (response.success && response.result) {
      return response.result as ICPRule;
    }
  } catch {
    console.warn('MCP unavailable, using mock ICP rules data');
  }

  // Use mock data
  return (
    mockICPRulesStore.find(r => r.id === ruleId && r.brain_id === brainId) ||
    null
  );
}

/**
 * Create a new ICP rule
 */
export async function createICPRule(
  brainId: string,
  data: CreateICPRuleRequest
): Promise<ICPRule> {
  const now = new Date().toISOString();
  const ruleId = crypto.randomUUID();

  const newRule: ICPRule = {
    id: ruleId,
    brain_id: brainId,
    category: data.category,
    attribute: data.attribute,
    display_name: data.display_name,
    condition: data.condition,
    score_weight: data.score_weight,
    is_knockout: data.is_knockout ?? false,
    reasoning: data.reasoning,
    created_at: now,
    updated_at: now,
  };

  try {
    const response = await mcpClient.createICPRule(brainId, data);
    if (response.success && response.result) {
      return response.result as ICPRule;
    }
  } catch {
    console.warn('MCP unavailable, using mock ICP rules store');
  }

  // Add to mock store
  mockICPRulesStore.push(newRule);
  return newRule;
}

/**
 * Update an ICP rule
 */
export async function updateICPRule(
  brainId: string,
  ruleId: string,
  data: UpdateICPRuleRequest
): Promise<ICPRule | null> {
  const now = new Date().toISOString();

  try {
    const response = await mcpClient.updateICPRule(brainId, ruleId, data);
    if (response.success && response.result) {
      return response.result as ICPRule;
    }
  } catch {
    console.warn('MCP unavailable, using mock ICP rules store');
  }

  // Update in mock store
  const index = mockICPRulesStore.findIndex(
    r => r.id === ruleId && r.brain_id === brainId
  );
  if (index === -1) return null;

  const existing = mockICPRulesStore[index];
  const updated: ICPRule = {
    ...existing,
    category: data.category ?? existing.category,
    attribute: data.attribute ?? existing.attribute,
    display_name: data.display_name ?? existing.display_name,
    condition: data.condition ?? existing.condition,
    score_weight: data.score_weight ?? existing.score_weight,
    is_knockout: data.is_knockout ?? existing.is_knockout,
    reasoning: data.reasoning !== undefined ? data.reasoning : existing.reasoning,
    updated_at: now,
  };

  mockICPRulesStore[index] = updated;
  return updated;
}

/**
 * Delete an ICP rule
 */
export async function deleteICPRule(
  brainId: string,
  ruleId: string
): Promise<boolean> {
  try {
    const response = await mcpClient.deleteICPRule(brainId, ruleId);
    if (response.success) {
      return true;
    }
  } catch {
    console.warn('MCP unavailable, using mock ICP rules store');
  }

  // Delete from mock store
  const index = mockICPRulesStore.findIndex(
    r => r.id === ruleId && r.brain_id === brainId
  );
  if (index === -1) return false;

  mockICPRulesStore.splice(index, 1);
  return true;
}

/**
 * Bulk import ICP rules
 */
export async function bulkImportICPRules(
  brainId: string,
  data: BulkImportICPRulesRequest
): Promise<{
  imported: number;
  skipped: number;
  errors: Array<{ index: number; error: string }>;
}> {
  const now = new Date().toISOString();
  const errors: Array<{ index: number; error: string }> = [];
  let imported = 0;
  let skipped = 0;

  // If replace_existing, delete all existing rules for this brain
  if (data.replace_existing) {
    try {
      // Try MCP first
      await mcpClient.deleteAllICPRules(brainId);
    } catch {
      // Fall back to mock store
      mockICPRulesStore = mockICPRulesStore.filter(r => r.brain_id !== brainId);
    }
  }

  // Import each rule
  for (let i = 0; i < data.rules.length; i++) {
    const ruleData = data.rules[i];

    try {
      // Check for duplicate attribute in same category
      const { rules: existingRules } = await listICPRules(brainId, {
        category: ruleData.category,
      });

      const isDuplicate = existingRules.some(
        r => r.attribute === ruleData.attribute
      );

      if (isDuplicate && !data.replace_existing) {
        skipped++;
        continue;
      }

      const newRule: ICPRule = {
        id: crypto.randomUUID(),
        brain_id: brainId,
        category: ruleData.category,
        attribute: ruleData.attribute,
        display_name: ruleData.display_name,
        condition: ruleData.condition,
        score_weight: ruleData.score_weight,
        is_knockout: ruleData.is_knockout ?? false,
        reasoning: ruleData.reasoning,
        created_at: now,
        updated_at: now,
      };

      mockICPRulesStore.push(newRule);
      imported++;
    } catch (error) {
      errors.push({
        index: i,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { imported, skipped, errors };
}

/**
 * Get ICP rules count for a brain
 */
export async function getICPRulesCount(brainId: string): Promise<number> {
  const { total } = await listICPRules(brainId);
  return total;
}

/**
 * Get ICP rules grouped by category
 */
export async function getICPRulesByCategory(
  brainId: string
): Promise<Record<ICPCategory, ICPRule[]>> {
  const { rules } = await listICPRules(brainId);

  const grouped: Record<ICPCategory, ICPRule[]> = {
    firmographic: [],
    technographic: [],
    behavioral: [],
    engagement: [],
  };

  for (const rule of rules) {
    grouped[rule.category].push(rule);
  }

  return grouped;
}
