/**
 * Activity feed hooks
 * React Query hooks for fetching and managing activity data
 * Uses SSE for real-time updates with fallback polling
 */
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useSSE } from './useSSE';

// Types matching the API response
export interface ActivityEvent {
  id: string;
  timestamp: string;
  agent: 'lead_scorer' | 'reply_handler' | 'meeting_prep' | 'learning_loop';
  event_type:
    | 'lead_scored'
    | 'reply_classified'
    | 'reply_sent'
    | 'brief_generated'
    | 'brief_delivered'
    | 'insight_extracted'
    | 'insight_validated'
    | 'error';
  summary: string;
  details_link: string | null;
  lead_id: string | null;
  brain_id: string | null;
}

interface ActivityFeedResponse {
  success: true;
  activities: ActivityEvent[];
  total: number;
  has_more: boolean;
}

interface ActivityFeedParams {
  limit?: number;
  agent?: string;
  event_type?: string;
}

// Query key factory
export const activityKeys = {
  all: ['activity'] as const,
  list: (params?: ActivityFeedParams) => [...activityKeys.all, 'list', params] as const,
  infinite: (params?: ActivityFeedParams) => [...activityKeys.all, 'infinite', params] as const,
};

/**
 * Fetch activity feed with pagination
 */
async function fetchActivityFeed(params: {
  limit: number;
  offset: number;
  agent?: string;
  event_type?: string;
}): Promise<ActivityFeedResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', params.limit.toString());
  searchParams.set('offset', params.offset.toString());
  if (params.agent) searchParams.set('agent', params.agent);
  if (params.event_type) searchParams.set('event_type', params.event_type);

  return api.get<ActivityFeedResponse>(`/activity?${searchParams.toString()}`);
}

/**
 * Hook for fetching activity feed (single page)
 * Uses SSE for real-time updates - new activities trigger cache invalidation
 */
export function useActivityFeed(params: ActivityFeedParams = {}) {
  const { limit = 20, agent, event_type } = params;
  const { isConnected } = useSSE();

  return useQuery({
    queryKey: activityKeys.list(params),
    queryFn: () => fetchActivityFeed({ limit, offset: 0, agent, event_type }),
    // Only poll if SSE is disconnected (fallback polling)
    refetchInterval: isConnected ? false : 30 * 1000,
  });
}

/**
 * Hook for infinite scrolling activity feed
 * Uses SSE for real-time updates with fallback polling
 */
export function useInfiniteActivityFeed(params: ActivityFeedParams = {}) {
  const { limit = 20, agent, event_type } = params;
  const { isConnected } = useSSE();

  return useInfiniteQuery({
    queryKey: activityKeys.infinite(params),
    queryFn: ({ pageParam = 0 }) =>
      fetchActivityFeed({ limit, offset: pageParam, agent, event_type }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined;
      // Calculate next offset based on all fetched items
      const totalFetched = allPages.reduce((sum, page) => sum + page.activities.length, 0);
      return totalFetched;
    },
    initialPageParam: 0,
    // Only poll if SSE is disconnected (fallback polling)
    refetchInterval: isConnected ? false : 30 * 1000,
  });
}

/**
 * Get all activities from infinite query pages
 */
export function flattenActivityPages(
  pages: ActivityFeedResponse[] | undefined
): ActivityEvent[] {
  if (!pages) return [];
  return pages.flatMap((page) => page.activities);
}
