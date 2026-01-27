/**
 * Objection Handlers service
 * Manages handler CRUD operations via MCP REST API
 */
import {
  ObjectionHandler,
  CreateHandlerRequest,
  UpdateHandlerRequest,
  ListHandlersParams,
  UsageStats,
  ObjectionType,
} from '../contracts';
import { mcpClient } from './mcp-client';

/**
 * Mock handlers data for development (when MCP is unavailable)
 */
function getMockHandlers(): ObjectionHandler[] {
  const now = new Date().toISOString();
  return [
    {
      id: '770e8400-e29b-41d4-a716-446655440001',
      brain_id: 'brain_fintech_demo',
      objection_type: 'budget',
      triggers: [
        'too expensive',
        'not in budget',
        'can\'t afford',
        'cost too high',
        'price is too much',
      ],
      handler_strategy:
        'Acknowledge the concern, then pivot to ROI and value. Offer flexible payment options if available.',
      response: `Hi {{first_name}},

I completely understand budget concerns - it's one of the most common questions we get.

What I've found is that companies like {{company_name}} typically see a 3-4x ROI within the first 6 months. The key is {{value_proposition}}.

Would it help if I shared a quick case study showing the actual numbers from a similar company?

Best,
{{sender_name}}`,
      variables: ['first_name', 'company_name', 'value_proposition', 'sender_name'],
      follow_ups: [
        'Share ROI calculator',
        'Send case study',
        'Offer pilot program',
      ],
      usage_stats: {
        times_matched: 89,
        times_used: 67,
        success_rate: 0.42,
        last_matched: '2024-01-20T14:30:00Z',
      },
      created_at: '2024-01-10T09:00:00Z',
      updated_at: now,
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440002',
      brain_id: 'brain_fintech_demo',
      objection_type: 'timing',
      triggers: [
        'not the right time',
        'too busy',
        'maybe next quarter',
        'reach out later',
        'bad timing',
      ],
      handler_strategy:
        'Validate their timing concern, create urgency around opportunity cost, and offer a low-commitment next step.',
      response: `Hi {{first_name}},

I totally get it - timing is everything. Just curious, what's making this quarter particularly challenging?

The reason I ask is that {{urgency_reason}}. I'd hate for {{company_name}} to miss out on {{benefit}}.

Would a quick 10-minute call to explore if there's a fit worth a few minutes of your time?

Best,
{{sender_name}}`,
      variables: [
        'first_name',
        'urgency_reason',
        'company_name',
        'benefit',
        'sender_name',
      ],
      follow_ups: ['Set reminder for follow-up', 'Send relevant content', 'Check in next quarter'],
      usage_stats: {
        times_matched: 56,
        times_used: 43,
        success_rate: 0.35,
        last_matched: '2024-01-19T11:00:00Z',
      },
      created_at: '2024-01-11T10:00:00Z',
      updated_at: now,
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440003',
      brain_id: 'brain_fintech_demo',
      objection_type: 'competitor',
      triggers: [
        'using competitor',
        'already have a solution',
        'working with another vendor',
        'happy with current provider',
        'already using',
      ],
      handler_strategy:
        'Acknowledge their current choice, then differentiate on specific capabilities they might be missing.',
      response: `Hi {{first_name}},

Thanks for sharing that - makes sense that you'd have something in place already.

Just curious, are you seeing {{pain_point}} with your current solution? That's actually where we tend to differentiate most.

Companies that have switched from {{competitor_name}} to us typically cite {{differentiator}} as the main reason.

Would you be open to a quick comparison call? Even if you decide to stay, you might pick up some useful insights.

Best,
{{sender_name}}`,
      variables: [
        'first_name',
        'pain_point',
        'competitor_name',
        'differentiator',
        'sender_name',
      ],
      follow_ups: [
        'Send competitive analysis',
        'Share switch case study',
        'Offer migration support details',
      ],
      usage_stats: {
        times_matched: 34,
        times_used: 28,
        success_rate: 0.32,
        last_matched: '2024-01-18T16:00:00Z',
      },
      created_at: '2024-01-12T14:00:00Z',
      updated_at: now,
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440004',
      brain_id: 'brain_fintech_demo',
      objection_type: 'authority',
      triggers: [
        'need to check with',
        'not the decision maker',
        'my boss',
        'need to involve',
        'team decision',
      ],
      handler_strategy:
        'Respect the process, offer to help build the internal case, and try to get introduced to decision makers.',
      response: `Hi {{first_name}},

Totally understand - these decisions often involve multiple stakeholders.

Would it be helpful if I put together a quick one-pager that you could share with {{stakeholder}}? I can include {{key_points}} that typically resonate with {{stakeholder_role}}s.

Alternatively, I'm happy to jump on a call with you and {{stakeholder}} together if that would make things easier.

Best,
{{sender_name}}`,
      variables: [
        'first_name',
        'stakeholder',
        'key_points',
        'stakeholder_role',
        'sender_name',
      ],
      follow_ups: [
        'Create executive summary',
        'Request intro to decision maker',
        'Schedule group call',
      ],
      usage_stats: {
        times_matched: 45,
        times_used: 38,
        success_rate: 0.45,
        last_matched: '2024-01-17T09:30:00Z',
      },
      created_at: '2024-01-13T11:00:00Z',
      updated_at: now,
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440005',
      brain_id: 'brain_fintech_demo',
      objection_type: 'need',
      triggers: [
        'don\'t need this',
        'not a priority',
        'not relevant',
        'doesn\'t apply',
        'no use case',
      ],
      handler_strategy:
        'Ask discovery questions to uncover latent needs or validate if truly not a fit.',
      response: `Hi {{first_name}},

I appreciate you being direct - definitely don't want to waste your time.

Just to make sure I understand, is it that {{company_name}} doesn't experience {{problem_statement}}? Or is it more that you have other priorities right now?

The reason I ask is that {{relevant_insight}} - but if it's genuinely not a fit, I respect that.

Best,
{{sender_name}}`,
      variables: [
        'first_name',
        'company_name',
        'problem_statement',
        'relevant_insight',
        'sender_name',
      ],
      follow_ups: ['Validate fit', 'Send relevant content', 'Close as not a fit if confirmed'],
      usage_stats: {
        times_matched: 23,
        times_used: 19,
        success_rate: 0.25,
        last_matched: '2024-01-16T08:00:00Z',
      },
      created_at: '2024-01-14T15:00:00Z',
      updated_at: now,
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440006',
      brain_id: 'brain_fintech_demo',
      objection_type: 'trust',
      triggers: [
        'never heard of you',
        'how do I know',
        'too risky',
        'not sure I trust',
        'need more proof',
      ],
      handler_strategy:
        'Build credibility with social proof, references, and transparency.',
      response: `Hi {{first_name}},

That's a fair concern - trust is earned, not given.

A few things that might help: We work with companies like {{reference_company}} and {{reference_company_2}}. I'd be happy to connect you with one of our customers who was in a similar situation.

We also offer {{guarantee_or_pilot}} so you can validate the results before any long-term commitment.

Would hearing from a reference or trying a pilot be more helpful for you?

Best,
{{sender_name}}`,
      variables: [
        'first_name',
        'reference_company',
        'reference_company_2',
        'guarantee_or_pilot',
        'sender_name',
      ],
      follow_ups: ['Arrange reference call', 'Send case studies', 'Propose pilot program'],
      usage_stats: {
        times_matched: 18,
        times_used: 15,
        success_rate: 0.38,
        last_matched: '2024-01-15T14:00:00Z',
      },
      created_at: '2024-01-15T10:00:00Z',
      updated_at: now,
    },
    // SaaS brain handlers
    {
      id: '770e8400-e29b-41d4-a716-446655440007',
      brain_id: 'brain_saas_demo',
      objection_type: 'budget',
      triggers: ['expensive', 'costs too much', 'over budget', 'no budget'],
      handler_strategy:
        'Focus on value per user and productivity gains. Emphasize free trial to prove value.',
      response: `Hey {{first_name}},

I hear you on budget - it's always a consideration.

Quick question: how much time does your team spend on {{manual_task}} right now? Most teams tell us it's 5-10 hours per week per person.

At {{company_name}}'s size, that's probably costing way more than our solution would. Want me to run the numbers with you?

Cheers,
{{sender_name}}`,
      variables: ['first_name', 'manual_task', 'company_name', 'sender_name'],
      follow_ups: ['Share ROI calculator', 'Offer extended trial', 'Discuss team pricing'],
      usage_stats: {
        times_matched: 42,
        times_used: 35,
        success_rate: 0.48,
        last_matched: '2024-01-21T10:00:00Z',
      },
      created_at: '2024-02-01T09:00:00Z',
      updated_at: now,
    },
  ];
}

// In-memory store for development
let mockHandlersStore: ObjectionHandler[] = getMockHandlers();

/**
 * Calculate simple keyword-based matching confidence
 */
function calculateMatchConfidence(
  objectionText: string,
  triggers: string[]
): number {
  const normalizedText = objectionText.toLowerCase();
  let matchedTriggers = 0;
  let totalWeight = 0;

  for (const trigger of triggers) {
    const normalizedTrigger = trigger.toLowerCase();
    if (normalizedText.includes(normalizedTrigger)) {
      matchedTriggers++;
      // Longer triggers are more specific, so weight them higher
      totalWeight += normalizedTrigger.split(' ').length;
    }
  }

  if (matchedTriggers === 0) return 0;

  // Base confidence from number of matches
  const matchRatio = matchedTriggers / triggers.length;
  // Bonus for weighted matches (longer phrases)
  const weightBonus = Math.min(totalWeight / 10, 0.3);

  return Math.min(matchRatio + weightBonus, 1);
}

/**
 * List handlers for a brain with optional filtering
 */
export async function listHandlers(
  brainId: string,
  params?: ListHandlersParams
): Promise<{ handlers: ObjectionHandler[]; total: number }> {
  try {
    // Try MCP first
    const response = await mcpClient.listHandlers(brainId, params?.objection_type);
    if (response.success && response.result && Array.isArray(response.result)) {
      let handlers = response.result as ObjectionHandler[];

      // Apply search filter if provided
      if (params?.search) {
        const searchLower = params.search.toLowerCase();
        handlers = handlers.filter(
          h =>
            h.triggers.some(t => t.toLowerCase().includes(searchLower)) ||
            h.response.toLowerCase().includes(searchLower) ||
            h.handler_strategy.toLowerCase().includes(searchLower)
        );
      }

      return { handlers, total: handlers.length };
    }
  } catch {
    console.warn('MCP unavailable, using mock handlers data');
  }

  // Use mock data
  let handlers = mockHandlersStore.filter(h => h.brain_id === brainId);

  // Apply filters
  if (params?.objection_type) {
    handlers = handlers.filter(h => h.objection_type === params.objection_type);
  }
  if (params?.search) {
    const searchLower = params.search.toLowerCase();
    handlers = handlers.filter(
      h =>
        h.triggers.some(t => t.toLowerCase().includes(searchLower)) ||
        h.response.toLowerCase().includes(searchLower) ||
        h.handler_strategy.toLowerCase().includes(searchLower)
    );
  }

  return { handlers, total: handlers.length };
}

/**
 * Get a single handler by ID
 */
export async function getHandler(
  brainId: string,
  handlerId: string
): Promise<ObjectionHandler | null> {
  try {
    const response = await mcpClient.getHandler(brainId, handlerId);
    if (response.success && response.result) {
      return response.result as ObjectionHandler;
    }
  } catch {
    console.warn('MCP unavailable, using mock handlers data');
  }

  // Use mock data
  return (
    mockHandlersStore.find(h => h.id === handlerId && h.brain_id === brainId) ||
    null
  );
}

/**
 * Create a new handler
 */
export async function createHandler(
  brainId: string,
  data: CreateHandlerRequest
): Promise<ObjectionHandler> {
  const now = new Date().toISOString();
  const handlerId = crypto.randomUUID();

  const newHandler: ObjectionHandler = {
    id: handlerId,
    brain_id: brainId,
    objection_type: data.objection_type,
    triggers: data.triggers,
    handler_strategy: data.handler_strategy,
    response: data.response,
    variables: data.variables || [],
    follow_ups: data.follow_ups || [],
    usage_stats: null,
    created_at: now,
    updated_at: now,
  };

  try {
    const response = await mcpClient.createHandler(brainId, data);
    if (response.success && response.result) {
      return response.result as ObjectionHandler;
    }
  } catch {
    console.warn('MCP unavailable, using mock handlers store');
  }

  // Add to mock store
  mockHandlersStore.push(newHandler);
  return newHandler;
}

/**
 * Update a handler
 */
export async function updateHandler(
  brainId: string,
  handlerId: string,
  data: UpdateHandlerRequest
): Promise<ObjectionHandler | null> {
  const now = new Date().toISOString();

  try {
    const response = await mcpClient.updateHandler(brainId, handlerId, data);
    if (response.success && response.result) {
      return response.result as ObjectionHandler;
    }
  } catch {
    console.warn('MCP unavailable, using mock handlers store');
  }

  // Update in mock store
  const index = mockHandlersStore.findIndex(
    h => h.id === handlerId && h.brain_id === brainId
  );
  if (index === -1) return null;

  const existing = mockHandlersStore[index];

  const updated: ObjectionHandler = {
    ...existing,
    objection_type: data.objection_type ?? existing.objection_type,
    triggers: data.triggers ?? existing.triggers,
    handler_strategy: data.handler_strategy ?? existing.handler_strategy,
    response: data.response ?? existing.response,
    variables: data.variables ?? existing.variables,
    follow_ups: data.follow_ups ?? existing.follow_ups,
    updated_at: now,
  };

  mockHandlersStore[index] = updated;
  return updated;
}

/**
 * Delete a handler
 */
export async function deleteHandler(
  brainId: string,
  handlerId: string
): Promise<boolean> {
  try {
    const response = await mcpClient.deleteHandler(brainId, handlerId);
    if (response.success) {
      return true;
    }
  } catch {
    console.warn('MCP unavailable, using mock handlers store');
  }

  // Delete from mock store
  const index = mockHandlersStore.findIndex(
    h => h.id === handlerId && h.brain_id === brainId
  );
  if (index === -1) return false;

  mockHandlersStore.splice(index, 1);
  return true;
}

/**
 * Test match an objection text against handlers
 */
export async function testMatchHandlers(
  brainId: string,
  objectionText: string,
  limit: number = 5
): Promise<{ matches: Array<{ handler: ObjectionHandler; confidence: number }> }> {
  // Get all handlers for the brain
  const { handlers } = await listHandlers(brainId);

  // Calculate confidence for each handler
  const scoredHandlers = handlers
    .map(handler => ({
      handler,
      confidence: calculateMatchConfidence(objectionText, handler.triggers),
    }))
    .filter(({ confidence }) => confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);

  return { matches: scoredHandlers };
}

/**
 * Get handlers count for a brain
 */
export async function getHandlersCount(brainId: string): Promise<number> {
  const { total } = await listHandlers(brainId);
  return total;
}

/**
 * Get handlers grouped by objection type
 */
export async function getHandlersByType(
  brainId: string
): Promise<Record<ObjectionType, ObjectionHandler[]>> {
  const { handlers } = await listHandlers(brainId);

  const grouped: Record<ObjectionType, ObjectionHandler[]> = {
    budget: [],
    timing: [],
    competitor: [],
    authority: [],
    need: [],
    trust: [],
    other: [],
  };

  for (const handler of handlers) {
    grouped[handler.objection_type].push(handler);
  }

  return grouped;
}

/**
 * Extract variables from handler response text
 */
export function extractHandlerVariables(responseText: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(responseText)) !== null) {
    const variable = match[1];
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }

  return variables;
}

/**
 * Objection type display names
 */
export const OBJECTION_TYPE_DISPLAY_NAMES: Record<ObjectionType, string> = {
  budget: 'Budget/Price',
  timing: 'Timing',
  competitor: 'Competitor',
  authority: 'Authority/Decision',
  need: 'No Need',
  trust: 'Trust/Risk',
  other: 'Other',
};

/**
 * Objection type descriptions
 */
export const OBJECTION_TYPE_DESCRIPTIONS: Record<ObjectionType, string> = {
  budget: 'Concerns about cost, pricing, or budget constraints',
  timing: 'Not the right time, too busy, or want to wait',
  competitor: 'Already using another solution or vendor',
  authority: 'Need to involve other decision makers',
  need: 'Don\'t see the need or relevance',
  trust: 'Concerns about credibility, risk, or reliability',
  other: 'Other objections that don\'t fit standard categories',
};
