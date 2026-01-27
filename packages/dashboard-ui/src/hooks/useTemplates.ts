/**
 * useTemplates hook
 * React Query hooks for managing response templates with optimistic UI and conflict resolution
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/services/api';
import { toast } from '@/components/ui/toast';

// ============================================================================
// Types
// ============================================================================

export type ReplyType =
  | 'positive_interest'
  | 'question'
  | 'objection'
  | 'not_interested'
  | 'out_of_office'
  | 'other';

export const REPLY_TYPES: ReplyType[] = [
  'positive_interest',
  'question',
  'objection',
  'not_interested',
  'out_of_office',
  'other',
];

export interface TemplateMetrics {
  times_used: number;
  reply_rate: number;
  positive_rate: number;
  last_used?: string;
}

export interface ResponseTemplate {
  id: string;
  brain_id: string;
  reply_type: ReplyType;
  tier: 1 | 2 | 3;
  template_text: string;
  variables: string[];
  personalization: Record<string, string>;
  metrics: TemplateMetrics | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateRequest {
  reply_type: ReplyType;
  tier: 1 | 2 | 3;
  template_text: string;
  variables?: string[];
  personalization?: Record<string, string>;
}

export interface UpdateTemplateRequest {
  reply_type?: ReplyType;
  tier?: 1 | 2 | 3;
  template_text?: string;
  variables?: string[];
  personalization?: Record<string, string>;
}

export interface ListTemplatesParams {
  reply_type?: ReplyType;
  tier?: number;
}

export interface PreviewResult {
  preview: string;
  detected_variables: string[];
}

// Conflict resolution types for concurrent edits
export interface ConflictState {
  hasConflict: boolean;
  localVersion: ResponseTemplate | null;
  serverVersion: ResponseTemplate | null;
  pendingChanges: UpdateTemplateRequest | null;
}

export type ConflictResolution = 'keep-local' | 'use-server' | 'merge';

// Standard template variables
export const STANDARD_TEMPLATE_VARIABLES = [
  'first_name',
  'last_name',
  'company_name',
  'title',
  'industry',
  'company_size',
  'location',
  'sender_name',
  'sender_title',
  'meeting_link',
  'calendar_link',
] as const;

// ============================================================================
// Query Key Factory
// ============================================================================

export const templateKeys = {
  all: ['templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (brainId: string, filters?: ListTemplatesParams) =>
    [...templateKeys.lists(), brainId, filters] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (brainId: string, templateId: string) =>
    [...templateKeys.details(), brainId, templateId] as const,
  variables: () => [...templateKeys.all, 'variables'] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch all templates for a brain
 */
export function useTemplates(brainId: string | undefined, filters?: ListTemplatesParams) {
  return useQuery({
    queryKey: templateKeys.list(brainId ?? '', filters),
    queryFn: async () => {
      if (!brainId) throw new Error('Brain ID is required');

      const params = new URLSearchParams();
      if (filters?.reply_type) params.append('reply_type', filters.reply_type);
      if (filters?.tier) params.append('tier', String(filters.tier));

      const query = params.toString();
      const response = await api.get<{
        success: boolean;
        templates: ResponseTemplate[];
        total: number;
      }>(`/brains/${brainId}/templates${query ? `?${query}` : ''}`);

      return response;
    },
    enabled: !!brainId,
    refetchOnWindowFocus: false, // Prevent flickering on tab focus
    staleTime: 60 * 1000, // Keep data fresh for 1 minute
  });
}

/**
 * Fetch a single template
 */
export function useTemplate(brainId: string | undefined, templateId: string | undefined) {
  return useQuery({
    queryKey: templateKeys.detail(brainId ?? '', templateId ?? ''),
    queryFn: async () => {
      if (!brainId || !templateId) throw new Error('Brain ID and Template ID are required');

      const response = await api.get<{
        success: boolean;
        template: ResponseTemplate;
      }>(`/brains/${brainId}/templates/${templateId}`);

      return response.template;
    },
    enabled: !!brainId && !!templateId,
  });
}

/**
 * Fetch standard variables
 */
export function useStandardVariables(brainId: string | undefined) {
  return useQuery({
    queryKey: templateKeys.variables(),
    queryFn: async () => {
      if (!brainId) throw new Error('Brain ID is required');

      const response = await api.get<{
        success: boolean;
        variables: string[];
      }>(`/brains/${brainId}/templates/variables`);

      return response.variables;
    },
    enabled: !!brainId,
    staleTime: Infinity, // Variables don't change often
  });
}

/**
 * Create a new template
 */
export function useCreateTemplate(brainId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTemplateRequest) => {
      const response = await api.post<{
        success: boolean;
        template: ResponseTemplate;
      }>(`/brains/${brainId}/templates`, data);

      return response.template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      toast({
        variant: 'success',
        title: 'Template created',
        description: 'The response template has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to create template',
        description: error.message || 'An unexpected error occurred.',
      });
    },
  });
}

/**
 * Update a template with optimistic UI and conflict resolution
 */
export function useUpdateTemplate(brainId: string, templateId: string) {
  const queryClient = useQueryClient();
  const [conflictState, setConflictState] = useState<ConflictState>({
    hasConflict: false,
    localVersion: null,
    serverVersion: null,
    pendingChanges: null,
  });

  const clearConflict = useCallback(() => {
    setConflictState({
      hasConflict: false,
      localVersion: null,
      serverVersion: null,
      pendingChanges: null,
    });
  }, []);

  const mutation = useMutation({
    mutationFn: async (data: UpdateTemplateRequest & { expected_updated_at?: string }) => {
      const response = await api.put<{
        success: boolean;
        template: ResponseTemplate;
      }>(`/brains/${brainId}/templates/${templateId}`, data);

      return response.template;
    },
    onMutate: async (newData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: templateKeys.detail(brainId, templateId) });
      await queryClient.cancelQueries({ queryKey: templateKeys.lists() });

      // Snapshot the previous values
      const previousTemplate = queryClient.getQueryData<ResponseTemplate>(
        templateKeys.detail(brainId, templateId)
      );
      const previousList = queryClient.getQueryData<{
        success: boolean;
        templates: ResponseTemplate[];
        total: number;
      }>(templateKeys.list(brainId, {}));

      // Optimistically update the cache
      if (previousTemplate) {
        const optimisticTemplate: ResponseTemplate = {
          ...previousTemplate,
          ...newData,
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData(
          templateKeys.detail(brainId, templateId),
          optimisticTemplate
        );

        // Also update in the list if present
        if (previousList) {
          queryClient.setQueryData(templateKeys.list(brainId, {}), {
            ...previousList,
            templates: previousList.templates.map((t) =>
              t.id === templateId ? optimisticTemplate : t
            ),
          });
        }
      }

      return { previousTemplate, previousList, pendingChanges: newData };
    },
    onError: (error: Error, _variables, context) => {
      // Check if this is a conflict error (409 status)
      if (error instanceof ApiClientError && error.status === 409) {
        // Fetch the latest server version
        api.get<{ success: boolean; template: ResponseTemplate }>(
          `/brains/${brainId}/templates/${templateId}`
        ).then((response) => {
          setConflictState({
            hasConflict: true,
            localVersion: context?.previousTemplate ?? null,
            serverVersion: response.template,
            pendingChanges: context?.pendingChanges ?? null,
          });

          toast({
            variant: 'default',
            title: 'Conflict detected',
            description:
              'This template was modified by someone else. Please review and resolve the conflict.',
          });
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to update template',
          description: error.message || 'An unexpected error occurred.',
        });
      }

      // Rollback on error
      if (context?.previousTemplate) {
        queryClient.setQueryData(
          templateKeys.detail(brainId, templateId),
          context.previousTemplate
        );
      }
      if (context?.previousList) {
        queryClient.setQueryData(templateKeys.list(brainId, {}), context.previousList);
      }
    },
    onSuccess: (updatedTemplate) => {
      clearConflict();
      queryClient.setQueryData(
        templateKeys.detail(brainId, templateId),
        updatedTemplate
      );
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      toast({
        variant: 'success',
        title: 'Template updated',
        description: 'The response template has been updated successfully.',
      });
    },
  });

  // Resolve conflict with chosen strategy
  const resolveConflict = useCallback(
    async (resolution: ConflictResolution) => {
      if (!conflictState.hasConflict) return;

      const { serverVersion, pendingChanges, localVersion } = conflictState;

      switch (resolution) {
        case 'use-server':
          // Accept server version, discard local changes
          if (serverVersion) {
            queryClient.setQueryData(templateKeys.detail(brainId, templateId), serverVersion);
            queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
          }
          clearConflict();
          toast({
            variant: 'default',
            title: 'Kept server version',
            description: 'Your local changes have been discarded.',
          });
          break;

        case 'keep-local':
          // Force overwrite with local changes (retry with force flag)
          if (pendingChanges && serverVersion) {
            try {
              const response = await api.put<{
                success: boolean;
                template: ResponseTemplate;
              }>(`/brains/${brainId}/templates/${templateId}`, {
                ...pendingChanges,
                force: true, // Backend should support force flag
              });
              queryClient.setQueryData(templateKeys.detail(brainId, templateId), response.template);
              queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
              clearConflict();
              toast({
                variant: 'success',
                title: 'Template updated',
                description: 'Your local changes have been saved.',
              });
            } catch (error) {
              toast({
                variant: 'destructive',
                title: 'Failed to save',
                description: error instanceof Error ? error.message : 'Could not save changes.',
              });
            }
          }
          break;

        case 'merge':
          // Merge changes: prefer local for text, server for metadata
          if (serverVersion && pendingChanges && localVersion) {
            const merged: UpdateTemplateRequest = {
              // Prefer local text changes if modified
              template_text: pendingChanges.template_text ?? serverVersion.template_text,
              // Prefer local variables if modified
              variables: pendingChanges.variables ?? serverVersion.variables,
              // Take server metadata (metrics, timestamps managed by server)
              reply_type: pendingChanges.reply_type ?? serverVersion.reply_type,
              tier: pendingChanges.tier ?? serverVersion.tier,
              personalization: pendingChanges.personalization ?? serverVersion.personalization,
            };

            try {
              const response = await api.put<{
                success: boolean;
                template: ResponseTemplate;
              }>(`/brains/${brainId}/templates/${templateId}`, {
                ...merged,
                force: true,
              });
              queryClient.setQueryData(templateKeys.detail(brainId, templateId), response.template);
              queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
              clearConflict();
              toast({
                variant: 'success',
                title: 'Changes merged',
                description: 'Local and server changes have been combined.',
              });
            } catch (error) {
              toast({
                variant: 'destructive',
                title: 'Merge failed',
                description: error instanceof Error ? error.message : 'Could not merge changes.',
              });
            }
          }
          break;
      }
    },
    [brainId, templateId, conflictState, clearConflict, queryClient]
  );

  return {
    ...mutation,
    conflictState,
    resolveConflict,
    clearConflict,
  };
}

/**
 * Delete a template with optimistic update
 */
export function useDeleteTemplate(brainId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      await api.delete(`/brains/${brainId}/templates/${templateId}`);
      return templateId;
    },
    onMutate: async (templateId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: templateKeys.lists() });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<{
        success: boolean;
        templates: ResponseTemplate[];
        total: number;
      }>(templateKeys.list(brainId, {}));

      // Optimistically remove the template
      if (previousData) {
        queryClient.setQueryData(templateKeys.list(brainId, {}), {
          ...previousData,
          templates: previousData.templates.filter((t) => t.id !== templateId),
          total: previousData.total - 1,
        });
      }

      return { previousData };
    },
    onError: (error: Error, _templateId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(templateKeys.list(brainId, {}), context.previousData);
      }
      toast({
        variant: 'destructive',
        title: 'Failed to delete template',
        description: error.message || 'An unexpected error occurred.',
      });
    },
    onSuccess: () => {
      toast({
        variant: 'success',
        title: 'Template deleted',
        description: 'The response template has been deleted.',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

/**
 * Preview a template with sample data
 */
export function usePreviewTemplate(brainId: string) {
  return useMutation({
    mutationFn: async ({
      templateText,
      sampleData,
    }: {
      templateText: string;
      sampleData?: Record<string, string>;
    }) => {
      const response = await api.post<{
        success: boolean;
        preview: string;
        detected_variables: string[];
      }>(`/brains/${brainId}/templates/preview`, {
        template_text: templateText,
        sample_data: sampleData,
      });

      return {
        preview: response.preview,
        detected_variables: response.detected_variables,
      };
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get display name for reply type
 */
export function getReplyTypeDisplayName(replyType: ReplyType): string {
  const names: Record<ReplyType, string> = {
    positive_interest: 'Positive Interest',
    question: 'Question',
    objection: 'Objection',
    not_interested: 'Not Interested',
    out_of_office: 'Out of Office',
    other: 'Other',
  };
  return names[replyType];
}

/**
 * Get color for reply type
 */
export function getReplyTypeColor(replyType: ReplyType): string {
  const colors: Record<ReplyType, string> = {
    positive_interest: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950',
    question: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950',
    objection: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-950',
    not_interested: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950',
    out_of_office: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800',
    other: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-950',
  };
  return colors[replyType];
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: number): string {
  const names: Record<number, string> = {
    1: 'Tier 1 (High Priority)',
    2: 'Tier 2 (Medium Priority)',
    3: 'Tier 3 (Low Priority)',
  };
  return names[tier] || `Tier ${tier}`;
}

/**
 * Get tier short name
 */
export function getTierShortName(tier: number): string {
  return `T${tier}`;
}

/**
 * Get tier color
 */
export function getTierColor(tier: number): string {
  const colors: Record<number, string> = {
    1: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950',
    2: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-950',
    3: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800',
  };
  return colors[tier] || 'text-gray-600 bg-gray-100';
}

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
 * Format metrics for display
 */
export function formatMetrics(metrics: TemplateMetrics | null): {
  usageText: string;
  replyRateText: string;
  positiveRateText: string;
} {
  if (!metrics) {
    return {
      usageText: 'Never used',
      replyRateText: 'N/A',
      positiveRateText: 'N/A',
    };
  }

  return {
    usageText: `${metrics.times_used} times`,
    replyRateText: `${(metrics.reply_rate * 100).toFixed(1)}%`,
    positiveRateText: `${(metrics.positive_rate * 100).toFixed(1)}%`,
  };
}
