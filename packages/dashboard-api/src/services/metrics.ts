/**
 * Metrics aggregation service
 * Aggregates lead scoring and activity metrics for dashboard display
 */
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

interface LeadsByTier {
  tier1: number;
  tier2: number;
  tier3: number;
  bucket_c: number;
}

interface RepliesByCategory {
  interested: number;
  objection: number;
  not_interested: number;
  meeting_request: number;
  out_of_office: number;
  other: number;
}

interface MetricsData {
  leads_scored: number;
  leads_by_tier: LeadsByTier;
  replies_classified: number;
  replies_by_category: RepliesByCategory;
  briefs_generated: number;
  insights_extracted: number;
  period: 'today' | '7d' | '30d';
  timestamp: string;
}

// Default state directory
const STATE_DIR = process.env.STATE_DIR || join(process.cwd(), '..', '..', 'state');

/**
 * Get cutoff timestamp for the given period
 */
function getCutoffTimestamp(period: 'today' | '7d' | '30d'): Date {
  const now = new Date();

  switch (period) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Parse Lead Scorer state file
 */
async function parseLeadScorerState(
  cutoff: Date
): Promise<{ scored: number; byTier: LeadsByTier }> {
  try {
    const statePath = join(STATE_DIR, 'lead_scorer-state.json');
    const content = await readFile(statePath, 'utf-8');
    const state = JSON.parse(content);

    let scored = 0;
    const byTier: LeadsByTier = { tier1: 0, tier2: 0, tier3: 0, bucket_c: 0 };

    if (state.processedLeads) {
      for (const [, data] of Object.entries(state.processedLeads) as [
        string,
        { timestamp?: string; tier?: string }
      ][]) {
        const ts = data.timestamp ? new Date(data.timestamp) : null;
        if (ts && ts >= cutoff) {
          scored++;
          const tier = data.tier?.toLowerCase() || '';
          if (tier === 'tier1' || tier === 'tier 1') byTier.tier1++;
          else if (tier === 'tier2' || tier === 'tier 2') byTier.tier2++;
          else if (tier === 'tier3' || tier === 'tier 3') byTier.tier3++;
          else if (tier === 'bucket_c' || tier === 'bucket c' || tier === 'c')
            byTier.bucket_c++;
        }
      }
    }

    return { scored, byTier };
  } catch {
    return { scored: 0, byTier: { tier1: 0, tier2: 0, tier3: 0, bucket_c: 0 } };
  }
}

/**
 * Parse Reply Handler state file
 */
async function parseReplyHandlerState(
  cutoff: Date
): Promise<{ classified: number; byCategory: RepliesByCategory }> {
  try {
    const statePath = join(STATE_DIR, 'reply_handler-state.json');
    const content = await readFile(statePath, 'utf-8');
    const state = JSON.parse(content);

    let classified = 0;
    const byCategory: RepliesByCategory = {
      interested: 0,
      objection: 0,
      not_interested: 0,
      meeting_request: 0,
      out_of_office: 0,
      other: 0,
    };

    if (state.processedReplies) {
      for (const [, data] of Object.entries(state.processedReplies) as [
        string,
        { timestamp?: string; category?: string }
      ][]) {
        const ts = data.timestamp ? new Date(data.timestamp) : null;
        if (ts && ts >= cutoff) {
          classified++;
          const category = data.category?.toLowerCase() || 'other';
          if (category in byCategory) {
            byCategory[category as keyof RepliesByCategory]++;
          } else {
            byCategory.other++;
          }
        }
      }
    }

    return { classified, byCategory };
  } catch {
    return {
      classified: 0,
      byCategory: {
        interested: 0,
        objection: 0,
        not_interested: 0,
        meeting_request: 0,
        out_of_office: 0,
        other: 0,
      },
    };
  }
}

/**
 * Parse Meeting Prep state file
 */
async function parseMeetingPrepState(cutoff: Date): Promise<number> {
  try {
    const statePath = join(STATE_DIR, 'meeting_prep-state.json');
    const content = await readFile(statePath, 'utf-8');
    const state = JSON.parse(content);

    let briefs = 0;

    if (state.generatedBriefs) {
      for (const [, data] of Object.entries(state.generatedBriefs) as [
        string,
        { timestamp?: string }
      ][]) {
        const ts = data.timestamp ? new Date(data.timestamp) : null;
        if (ts && ts >= cutoff) {
          briefs++;
        }
      }
    }

    return briefs;
  } catch {
    return 0;
  }
}

/**
 * Parse Learning Loop state file
 */
async function parseLearningLoopState(cutoff: Date): Promise<number> {
  try {
    const statePath = join(STATE_DIR, 'learning_loop-state.json');
    const content = await readFile(statePath, 'utf-8');
    const state = JSON.parse(content);

    let insights = 0;

    if (state.extractedInsights) {
      for (const [, data] of Object.entries(state.extractedInsights) as [
        string,
        { timestamp?: string }
      ][]) {
        const ts = data.timestamp ? new Date(data.timestamp) : null;
        if (ts && ts >= cutoff) {
          insights++;
        }
      }
    }

    return insights;
  } catch {
    return 0;
  }
}

/**
 * Aggregate metrics from all agent state files
 */
export async function aggregateMetrics(
  period: 'today' | '7d' | '30d' = 'today'
): Promise<MetricsData> {
  const cutoff = getCutoffTimestamp(period);

  // Fetch all metrics in parallel
  const [leadScorer, replyHandler, briefs, insights] = await Promise.all([
    parseLeadScorerState(cutoff),
    parseReplyHandlerState(cutoff),
    parseMeetingPrepState(cutoff),
    parseLearningLoopState(cutoff),
  ]);

  return {
    leads_scored: leadScorer.scored,
    leads_by_tier: leadScorer.byTier,
    replies_classified: replyHandler.classified,
    replies_by_category: replyHandler.byCategory,
    briefs_generated: briefs,
    insights_extracted: insights,
    period,
    timestamp: new Date().toISOString(),
  };
}

export type { MetricsData, LeadsByTier, RepliesByCategory };
