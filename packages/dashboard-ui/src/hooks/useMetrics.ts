/**
 * useMetrics hook
 * Fetches and manages dashboard metrics with configurable time periods
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export type MetricsPeriod = 'today' | '7d' | '30d';

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
  period: MetricsPeriod;
  timestamp: string;
}

interface MetricsSummary {
  leads_scored: number;
  tier1_count: number;
  replies_classified: number;
  interested_count: number;
  briefs_generated: number;
  insights_extracted: number;
  period: MetricsPeriod;
  timestamp: string;
}

interface UseMetricsOptions {
  period?: MetricsPeriod;
  refetchInterval?: number;
}

/**
 * Hook for fetching full metrics data
 */
export function useMetrics(options: UseMetricsOptions = {}) {
  const { period = 'today', refetchInterval = 60000 } = options;

  return useQuery({
    queryKey: ['metrics', period],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: MetricsData }>(
        `/metrics?period=${period}`
      );

      if (!response.success) {
        throw new Error('Failed to fetch metrics');
      }

      return response.data;
    },
    refetchInterval,
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}

/**
 * Hook for fetching simplified metrics summary (for widgets)
 */
export function useMetricsSummary(options: UseMetricsOptions = {}) {
  const { period = 'today', refetchInterval = 60000 } = options;

  return useQuery({
    queryKey: ['metrics', 'summary', period],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: MetricsSummary }>(
        `/metrics/summary?period=${period}`
      );

      if (!response.success) {
        throw new Error('Failed to fetch metrics summary');
      }

      return response.data;
    },
    refetchInterval,
    staleTime: 30000,
  });
}

export type { MetricsData, MetricsSummary, LeadsByTier, RepliesByCategory };
