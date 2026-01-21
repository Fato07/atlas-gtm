/**
 * Reply Handler Agent - Insight Extractor
 *
 * Extracts actionable insights from reply conversations for knowledge base enrichment.
 * Implements FR-022 (insight extraction), FR-023 (insight categorization).
 *
 * @module reply-handler/insight-extractor
 */

import Anthropic from '@anthropic-ai/sdk';
import { extractToolResult, forceToolChoice } from '@atlas-gtm/lib';
import type { Classification } from './contracts/handler-result';
import type { LeadContext } from './contracts/reply-input';
import { INSIGHT_TOOL, type InsightExtraction, type ExtractedInsightItem } from './contracts/insight-tool';

// ===========================================
// Insight Types
// ===========================================

export type InsightCategory =
  | 'buying_process'
  | 'pain_point'
  | 'competitor_mention'
  | 'objection_pattern'
  | 'success_indicator'
  | 'timing_signal'
  | 'decision_maker'
  | 'budget_indicator';

export type InsightImportance = 'high' | 'medium' | 'low';

export interface ExtractedInsight {
  /** Unique insight ID */
  id: string;

  /** Insight category */
  category: InsightCategory;

  /** Insight content/summary */
  content: string;

  /** Importance level */
  importance: InsightImportance;

  /** Whether this is actionable */
  actionable: boolean;

  /** Suggested actions based on insight */
  suggestedActions?: string[];

  /** Source context */
  source: {
    replyId: string;
    leadId: string;
    leadCompany?: string;
    leadIndustry?: string;
    extractedAt: string;
  };

  /** Confidence score */
  confidence: number;
}

// ===========================================
// Extractor Configuration
// ===========================================

export interface InsightExtractorConfig {
  /** Anthropic client for extraction */
  client: Anthropic;

  /** MCP client function for KB tools */
  callMcpTool: <T>(tool: string, params: Record<string, unknown>) => Promise<T>;

  /** Model settings */
  model?: string;
  maxTokens?: number;

  /** Minimum confidence for storing insights */
  minConfidence?: number;

  /** Enable auto-storage to KB */
  autoStoreToKB?: boolean;
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_MIN_CONFIDENCE = 0.7;

// ===========================================
// Insight Extractor Class
// ===========================================

export class InsightExtractor {
  private client: Anthropic;
  private callMcpTool: InsightExtractorConfig['callMcpTool'];
  private model: string;
  private maxTokens: number;
  private minConfidence: number;
  private autoStoreToKB: boolean;

  constructor(config: InsightExtractorConfig) {
    this.client = config.client;
    this.callMcpTool = config.callMcpTool;
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.minConfidence = config.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    this.autoStoreToKB = config.autoStoreToKB ?? true;
  }

  // ===========================================
  // Main Extraction Method
  // ===========================================

  /**
   * Extract insights from a reply conversation
   */
  async extractInsights(params: {
    replyId: string;
    replyText: string;
    classification: Classification;
    leadContext: LeadContext;
    threadContext?: string;
    brainId: string;
  }): Promise<{
    insights: ExtractedInsight[];
    tokensUsed: number;
    storedCount: number;
  }> {
    const { replyId, replyText, classification, leadContext, threadContext, brainId } = params;

    // Extract insights using Claude
    const extracted = await this.extractWithClaude({
      replyText,
      classification,
      leadContext,
      threadContext,
    });

    // Build insight objects with metadata
    const insights: ExtractedInsight[] = extracted.insights.map((raw, index) => ({
      id: `insight_${replyId}_${index}`,
      category: raw.category,
      content: raw.content,
      importance: raw.importance,
      actionable: raw.actionable,
      suggestedActions: raw.suggestedActions,
      source: {
        replyId,
        leadId: leadContext.id,
        leadCompany: leadContext.company,
        leadIndustry: leadContext.industry,
        extractedAt: new Date().toISOString(),
      },
      confidence: raw.confidence,
    }));

    // Filter by minimum confidence
    const qualifiedInsights = insights.filter(i => i.confidence >= this.minConfidence);

    // Store to KB if enabled
    let storedCount = 0;
    if (this.autoStoreToKB && qualifiedInsights.length > 0) {
      storedCount = await this.storeInsightsToKB(qualifiedInsights, brainId);
    }

    return {
      insights: qualifiedInsights,
      tokensUsed: extracted.tokensUsed,
      storedCount,
    };
  }

  // ===========================================
  // Claude Extraction
  // ===========================================

  /**
   * Use Claude to extract insights using structured outputs
   */
  private async extractWithClaude(params: {
    replyText: string;
    classification: Classification;
    leadContext: LeadContext;
    threadContext?: string;
  }): Promise<{
    insights: Array<{
      category: InsightCategory;
      content: string;
      importance: InsightImportance;
      actionable: boolean;
      suggestedActions?: string[];
      confidence: number;
    }>;
    tokensUsed: number;
  }> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(params);

    // Use structured outputs via tool use pattern
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      tools: [INSIGHT_TOOL.tool],
      tool_choice: forceToolChoice(INSIGHT_TOOL.name),
      messages: [{ role: 'user', content: userPrompt }],
    });

    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    // Extract tool result using structured output helper
    const toolResult = extractToolResult(response.content, INSIGHT_TOOL.name);
    if (!toolResult) {
      return {
        insights: [],
        tokensUsed,
      };
    }

    // Parse and validate with Zod schema (type-safe!)
    try {
      const parsed = INSIGHT_TOOL.parse(toolResult) as InsightExtraction;

      // Map the parsed insights to the expected format
      return {
        insights: parsed.insights.map((item: ExtractedInsightItem) => ({
          category: item.category as InsightCategory,
          content: item.content,
          importance: item.importance as InsightImportance,
          actionable: item.actionable,
          suggestedActions: item.action_suggestion ? [item.action_suggestion] : undefined,
          confidence: item.confidence,
        })),
        tokensUsed,
      };
    } catch {
      return {
        insights: [],
        tokensUsed,
      };
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert B2B sales insight extractor. Your task is to identify actionable insights from email reply conversations that can improve future sales outreach.

INSIGHT CATEGORIES:
- buying_process: Information about how the company makes purchasing decisions
- pain_point: Explicit problems or challenges the lead mentions
- competitive_intel: References to competitive solutions or alternatives (tools they use)
- objection: Common objection themes that could inform future responses
- messaging_effectiveness: What messaging resonated or fell flat

IMPORTANCE LEVELS:
- high: Directly actionable, affects immediate strategy
- medium: Useful context for personalization
- low: Background information for reference

For each insight, extract:
1. Category from the list above
2. Clear, actionable content describing the insight
3. Importance level based on strategic value
4. Whether it's actionable (suggests a specific action)
5. If actionable, a suggested action
6. Direct quote from the source (if applicable)
7. Confidence score (0.0-1.0)

Use the extract_insights tool to provide your structured analysis.`;
  }

  private buildUserPrompt(params: {
    replyText: string;
    classification: Classification;
    leadContext: LeadContext;
    threadContext?: string;
  }): string {
    const { replyText, classification, leadContext, threadContext } = params;

    let prompt = `Extract insights from this email reply:\n\n---\n${replyText}\n---\n`;

    prompt += `\nCONTEXT:`;
    prompt += `\n- Lead: ${leadContext.first_name ?? ''} ${leadContext.last_name ?? ''} at ${leadContext.company ?? 'Unknown Company'}`;
    prompt += `\n- Industry: ${leadContext.industry ?? 'Unknown'}`;
    prompt += `\n- Title: ${leadContext.title ?? 'Unknown'}`;
    prompt += `\n- Classified Intent: ${classification.intent}`;
    prompt += `\n- Sentiment: ${classification.sentiment.toFixed(2)}`;
    prompt += `\n- Complexity: ${classification.complexity}`;

    if (threadContext) {
      prompt += `\n\nPREVIOUS CONVERSATION:\n${threadContext}`;
    }

    prompt += '\n\nUse the extract_insights tool to provide your analysis.';

    return prompt;
  }

  // ===========================================
  // KB Storage
  // ===========================================

  /**
   * Store insights to knowledge base via MCP
   */
  private async storeInsightsToKB(
    insights: ExtractedInsight[],
    brainId: string
  ): Promise<number> {
    let storedCount = 0;

    for (const insight of insights) {
      try {
        const result = await this.callMcpTool<{
          status: 'created' | 'duplicate';
        }>('add_insight', {
          brain_id: brainId,
          content: insight.content,
          category: insight.category,
          importance: insight.importance,
          source: {
            type: 'email_reply',
            id: insight.source.replyId,
            company_name: insight.source.leadCompany,
            industry: insight.source.leadIndustry,
          },
        });

        if (result.status === 'created') {
          storedCount++;
        }
      } catch (error) {
        // Log but continue with other insights
        console.error(`Failed to store insight ${insight.id}:`, error);
      }
    }

    return storedCount;
  }

  // ===========================================
  // Batch Extraction
  // ===========================================

  /**
   * Extract insights from multiple replies in batch
   */
  async extractBatch(
    params: Array<{
      replyId: string;
      replyText: string;
      classification: Classification;
      leadContext: LeadContext;
      threadContext?: string;
      brainId: string;
    }>
  ): Promise<{
    results: Array<{
      replyId: string;
      insights: ExtractedInsight[];
      error?: string;
    }>;
    totalTokensUsed: number;
    totalStoredCount: number;
  }> {
    const results: Array<{
      replyId: string;
      insights: ExtractedInsight[];
      error?: string;
    }> = [];
    let totalTokensUsed = 0;
    let totalStoredCount = 0;

    for (const item of params) {
      try {
        const { insights, tokensUsed, storedCount } = await this.extractInsights(item);
        results.push({ replyId: item.replyId, insights });
        totalTokensUsed += tokensUsed;
        totalStoredCount += storedCount;
      } catch (error) {
        results.push({
          replyId: item.replyId,
          insights: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      results,
      totalTokensUsed,
      totalStoredCount,
    };
  }
}

// ===========================================
// Factory Function
// ===========================================

/**
 * Create an insight extractor
 */
export function createInsightExtractor(config: InsightExtractorConfig): InsightExtractor {
  return new InsightExtractor(config);
}

// ===========================================
// Insight Utilities
// ===========================================

/**
 * Filter insights by category
 */
export function filterByCategory(
  insights: ExtractedInsight[],
  category: InsightCategory
): ExtractedInsight[] {
  return insights.filter(i => i.category === category);
}

/**
 * Filter actionable insights
 */
export function filterActionable(insights: ExtractedInsight[]): ExtractedInsight[] {
  return insights.filter(i => i.actionable);
}

/**
 * Sort insights by importance
 */
export function sortByImportance(insights: ExtractedInsight[]): ExtractedInsight[] {
  const order: Record<InsightImportance, number> = { high: 0, medium: 1, low: 2 };
  return [...insights].sort((a, b) => order[a.importance] - order[b.importance]);
}

/**
 * Get suggested actions from all insights
 */
export function getAllSuggestedActions(insights: ExtractedInsight[]): string[] {
  const actions = new Set<string>();
  for (const insight of insights) {
    if (insight.suggestedActions) {
      for (const action of insight.suggestedActions) {
        actions.add(action);
      }
    }
  }
  return Array.from(actions);
}
