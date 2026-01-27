/**
 * useHandlers hook
 * React Query hooks for managing objection handlers
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { toast } from '@/components/ui/toast';

// ============================================================================
// Types
// ============================================================================

export type ObjectionType =
  | 'budget'
  | 'timing'
  | 'competitor'
  | 'authority'
  | 'need'
  | 'trust'
  | 'other';

export const OBJECTION_TYPES: ObjectionType[] = [
  'budget',
  'timing',
  'competitor',
  'authority',
  'need',
  'trust',
  'other',
];

export interface UsageStats {
  times_matched: number;
  times_used: number;
  success_rate: number;
  last_matched?: string;
}

export interface ObjectionHandler {
  id: string;
  brain_id: string;
  objection_type: ObjectionType;
  triggers: string[];
  handler_strategy: string;
  response: string;
  variables: string[];
  follow_ups: string[];
  usage_stats: UsageStats | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHandlerRequest {
  objection_type: ObjectionType;
  triggers: string[];
  handler_strategy: string;
  response: string;
  variables?: string[];
  follow_ups?: string[];
}

export interface UpdateHandlerRequest {
  objection_type?: ObjectionType;
  triggers?: string[];
  handler_strategy?: string;
  response?: string;
  variables?: string[];
  follow_ups?: string[];
}

export interface ListHandlersParams {
  objection_type?: ObjectionType;
  search?: string;
}

export interface HandlerMatch {
  handler: ObjectionHandler;
  confidence: number;
}

// ============================================================================
// Query Key Factory
// ============================================================================

export const handlerKeys = {
  all: ['handlers'] as const,
  lists: () => [...handlerKeys.all, 'list'] as const,
  list: (brainId: string, filters?: ListHandlersParams) =>
    [...handlerKeys.lists(), brainId, filters] as const,
  details: () => [...handlerKeys.all, 'detail'] as const,
  detail: (brainId: string, handlerId: string) =>
    [...handlerKeys.details(), brainId, handlerId] as const,
  types: () => [...handlerKeys.all, 'types'] as const,
  byType: (brainId: string) => [...handlerKeys.all, 'byType', brainId] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch all handlers for a brain
 */
export function useHandlers(brainId: string | undefined, filters?: ListHandlersParams) {
  return useQuery({
    queryKey: handlerKeys.list(brainId ?? '', filters),
    queryFn: async () => {
      if (!brainId) throw new Error('Brain ID is required');

      const params = new URLSearchParams();
      if (filters?.objection_type) params.append('objection_type', filters.objection_type);
      if (filters?.search) params.append('search', filters.search);

      const query = params.toString();
      const response = await api.get<{
        success: boolean;
        handlers: ObjectionHandler[];
        total: number;
      }>(`/brains/${brainId}/handlers${query ? `?${query}` : ''}`);

      return response;
    },
    enabled: !!brainId,
  });
}

/**
 * Fetch a single handler
 */
export function useHandler(brainId: string | undefined, handlerId: string | undefined) {
  return useQuery({
    queryKey: handlerKeys.detail(brainId ?? '', handlerId ?? ''),
    queryFn: async () => {
      if (!brainId || !handlerId) throw new Error('Brain ID and Handler ID are required');

      const response = await api.get<{
        success: boolean;
        handler: ObjectionHandler;
      }>(`/brains/${brainId}/handlers/${handlerId}`);

      return response.handler;
    },
    enabled: !!brainId && !!handlerId,
  });
}

/**
 * Fetch objection types metadata
 */
export function useObjectionTypes() {
  return useQuery({
    queryKey: handlerKeys.types(),
    queryFn: async () => {
      // This is mostly static data, so we can return it directly
      // The API provides it for consistency
      return [
        { type: 'budget', display_name: 'Budget/Price', description: 'Concerns about cost, pricing, or budget constraints' },
        { type: 'timing', display_name: 'Timing', description: 'Not the right time, too busy, or want to wait' },
        { type: 'competitor', display_name: 'Competitor', description: 'Already using another solution or vendor' },
        { type: 'authority', display_name: 'Authority/Decision', description: 'Need to involve other decision makers' },
        { type: 'need', display_name: 'No Need', description: "Don't see the need or relevance" },
        { type: 'trust', display_name: 'Trust/Risk', description: 'Concerns about credibility, risk, or reliability' },
        { type: 'other', display_name: 'Other', description: "Other objections that don't fit standard categories" },
      ];
    },
    staleTime: Infinity,
  });
}

/**
 * Fetch handlers grouped by objection type
 */
export function useHandlersByType(brainId: string | undefined) {
  return useQuery({
    queryKey: handlerKeys.byType(brainId ?? ''),
    queryFn: async () => {
      if (!brainId) throw new Error('Brain ID is required');

      const response = await api.get<{
        success: boolean;
        handlers_by_type: Record<ObjectionType, ObjectionHandler[]>;
      }>(`/brains/${brainId}/handlers/by-type`);

      return response.handlers_by_type;
    },
    enabled: !!brainId,
  });
}

/**
 * Create a new handler
 */
export function useCreateHandler(brainId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateHandlerRequest) => {
      const response = await api.post<{
        success: boolean;
        handler: ObjectionHandler;
      }>(`/brains/${brainId}/handlers`, data);

      return response.handler;
    },
    onSuccess: () => {
      // Invalidate handlers list
      queryClient.invalidateQueries({ queryKey: handlerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: handlerKeys.byType(brainId) });
      toast({
        variant: 'success',
        title: 'Handler created',
        description: 'The objection handler has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to create handler',
        description: error.message || 'An unexpected error occurred.',
      });
    },
  });
}

/**
 * Update a handler
 */
export function useUpdateHandler(brainId: string, handlerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateHandlerRequest) => {
      const response = await api.put<{
        success: boolean;
        handler: ObjectionHandler;
      }>(`/brains/${brainId}/handlers/${handlerId}`, data);

      return response.handler;
    },
    onSuccess: (updatedHandler) => {
      // Update cache
      queryClient.setQueryData(
        handlerKeys.detail(brainId, handlerId),
        updatedHandler
      );
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: handlerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: handlerKeys.byType(brainId) });
      toast({
        variant: 'success',
        title: 'Handler updated',
        description: 'The objection handler has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to update handler',
        description: error.message || 'An unexpected error occurred.',
      });
    },
  });
}

/**
 * Delete a handler with optimistic update
 */
export function useDeleteHandler(brainId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (handlerId: string) => {
      await api.delete(`/brains/${brainId}/handlers/${handlerId}`);
      return handlerId;
    },
    onMutate: async (handlerId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: handlerKeys.lists() });

      // Snapshot the previous value
      const previousHandlers = queryClient.getQueryData<{
        success: boolean;
        handlers: ObjectionHandler[];
        total: number;
      }>(handlerKeys.list(brainId, {}));

      // Optimistically remove the handler
      if (previousHandlers) {
        queryClient.setQueryData(handlerKeys.list(brainId, {}), {
          ...previousHandlers,
          handlers: previousHandlers.handlers.filter((h) => h.id !== handlerId),
          total: previousHandlers.total - 1,
        });
      }

      return { previousHandlers };
    },
    onError: (error: Error, _handlerId, context) => {
      // Rollback on error
      if (context?.previousHandlers) {
        queryClient.setQueryData(handlerKeys.list(brainId, {}), context.previousHandlers);
      }
      toast({
        variant: 'destructive',
        title: 'Failed to delete handler',
        description: error.message || 'An unexpected error occurred.',
      });
    },
    onSuccess: () => {
      toast({
        variant: 'success',
        title: 'Handler deleted',
        description: 'The objection handler has been deleted.',
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: handlerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: handlerKeys.byType(brainId) });
    },
  });
}

/**
 * Test match objection text against handlers
 */
export function useTestMatchHandlers(brainId: string) {
  return useMutation({
    mutationFn: async ({
      objectionText,
      limit = 5,
    }: {
      objectionText: string;
      limit?: number;
    }) => {
      const response = await api.post<{
        success: boolean;
        matches: HandlerMatch[];
      }>(`/brains/${brainId}/handlers/test-match`, {
        objection_text: objectionText,
        limit,
      });

      return response.matches;
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get display name for objection type
 */
export function getObjectionTypeDisplayName(objectionType: ObjectionType): string {
  const names: Record<ObjectionType, string> = {
    budget: 'Budget/Price',
    timing: 'Timing',
    competitor: 'Competitor',
    authority: 'Authority/Decision',
    need: 'No Need',
    trust: 'Trust/Risk',
    other: 'Other',
  };
  return names[objectionType];
}

/**
 * Get color for objection type
 */
export function getObjectionTypeColor(objectionType: ObjectionType): string {
  const colors: Record<ObjectionType, string> = {
    budget: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950',
    timing: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950',
    competitor: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-950',
    authority: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-950',
    need: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800',
    trust: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950',
    other: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800',
  };
  return colors[objectionType];
}

/**
 * Get icon name for objection type
 */
export function getObjectionTypeIcon(objectionType: ObjectionType): string {
  const icons: Record<ObjectionType, string> = {
    budget: 'dollar-sign',
    timing: 'clock',
    competitor: 'users',
    authority: 'user-check',
    need: 'help-circle',
    trust: 'shield',
    other: 'message-square',
  };
  return icons[objectionType];
}

/**
 * Format usage stats for display
 */
export function formatUsageStats(stats: UsageStats | null): {
  matchedText: string;
  usedText: string;
  successRateText: string;
} {
  if (!stats) {
    return {
      matchedText: 'Never matched',
      usedText: 'Never used',
      successRateText: 'N/A',
    };
  }

  return {
    matchedText: `${stats.times_matched} matches`,
    usedText: `${stats.times_used} times used`,
    successRateText: `${(stats.success_rate * 100).toFixed(1)}% success`,
  };
}

/**
 * Format confidence score for display
 */
export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(0)}%`;
}

/**
 * Get confidence level (high, medium, low)
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
}

/**
 * Get confidence color
 */
export function getConfidenceColor(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  const colors = {
    high: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950',
    medium: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-950',
    low: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950',
  };
  return colors[level];
}

/**
 * Extract variables from response text
 */
export function extractVariables(responseText: string): string[] {
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
 * Standard handler variables
 */
export const STANDARD_HANDLER_VARIABLES = [
  'first_name',
  'company_name',
  'sender_name',
  'value_proposition',
  'benefit',
  'pain_point',
  'competitor_name',
  'differentiator',
  'stakeholder',
  'stakeholder_role',
  'reference_company',
  'guarantee_or_pilot',
] as const;
