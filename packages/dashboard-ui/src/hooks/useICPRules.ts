/**
 * ICP Rules management hooks
 * React Query hooks for fetching and managing ICP rule data
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { toast } from '@/components/ui/toast';

// ============================================================================
// Types matching the API
// ============================================================================

export type ICPCategory = 'firmographic' | 'technographic' | 'behavioral' | 'engagement';

export type RuleOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'regex';

export interface RuleCondition {
  operator: RuleOperator;
  value: string | number | boolean | string[];
  case_sensitive?: boolean;
}

export interface ICPRule {
  id: string;
  brain_id: string;
  category: ICPCategory;
  attribute: string;
  display_name: string;
  condition: RuleCondition;
  score_weight: number;
  is_knockout: boolean;
  reasoning?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateICPRuleRequest {
  category: ICPCategory;
  attribute: string;
  display_name: string;
  condition: RuleCondition;
  score_weight: number;
  is_knockout?: boolean;
  reasoning?: string;
}

export interface UpdateICPRuleRequest {
  category?: ICPCategory;
  attribute?: string;
  display_name?: string;
  condition?: RuleCondition;
  score_weight?: number;
  is_knockout?: boolean;
  reasoning?: string;
}

export interface BulkImportICPRulesRequest {
  rules: CreateICPRuleRequest[];
  replace_existing?: boolean;
}

export interface ListICPRulesParams {
  category?: ICPCategory;
  is_knockout?: boolean;
  search?: string;
}

// API Response types
interface ICPRuleListResponse {
  success: true;
  rules: ICPRule[];
  total: number;
}

interface ICPRuleResponse {
  success: true;
  rule: ICPRule;
}

interface DeleteICPRuleResponse {
  success: true;
  deleted_id: string;
}

interface BulkImportICPRulesResponse {
  success: true;
  imported: number;
  skipped: number;
  errors: Array<{ index: number; error: string }>;
}

// ============================================================================
// Query Key Factory
// ============================================================================

export const icpRuleKeys = {
  all: (brainId: string) => ['icp-rules', brainId] as const,
  lists: (brainId: string) => [...icpRuleKeys.all(brainId), 'list'] as const,
  list: (brainId: string, filters?: ListICPRulesParams) =>
    [...icpRuleKeys.lists(brainId), filters] as const,
  details: (brainId: string) => [...icpRuleKeys.all(brainId), 'detail'] as const,
  detail: (brainId: string, ruleId: string) =>
    [...icpRuleKeys.details(brainId), ruleId] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch all ICP rules for a brain with optional filtering
 */
export function useICPRules(brainId: string | undefined, filters?: ListICPRulesParams) {
  const searchParams = new URLSearchParams();
  if (filters?.category) searchParams.set('category', filters.category);
  if (filters?.is_knockout !== undefined) searchParams.set('is_knockout', String(filters.is_knockout));
  if (filters?.search) searchParams.set('search', filters.search);
  const query = searchParams.toString();

  return useQuery({
    queryKey: icpRuleKeys.list(brainId!, filters),
    queryFn: () =>
      api.get<ICPRuleListResponse>(
        `/brains/${brainId}/icp-rules${query ? `?${query}` : ''}`
      ),
    select: (data) => ({ rules: data.rules, total: data.total }),
    enabled: !!brainId,
  });
}

/**
 * Fetch a single ICP rule by ID
 */
export function useICPRule(brainId: string | undefined, ruleId: string | undefined) {
  return useQuery({
    queryKey: icpRuleKeys.detail(brainId!, ruleId!),
    queryFn: () =>
      api.get<ICPRuleResponse>(`/brains/${brainId}/icp-rules/${ruleId}`),
    select: (data) => data.rule,
    enabled: !!brainId && !!ruleId,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create a new ICP rule
 */
export function useCreateICPRule(brainId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateICPRuleRequest) =>
      api.post<ICPRuleResponse>(`/brains/${brainId}/icp-rules`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: icpRuleKeys.lists(brainId) });
      toast({
        variant: 'success',
        title: 'Rule created',
        description: 'The ICP rule has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to create rule',
        description: error.message || 'An unexpected error occurred.',
      });
    },
  });
}

/**
 * Update an existing ICP rule
 */
export function useUpdateICPRule(brainId: string, ruleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateICPRuleRequest) =>
      api.put<ICPRuleResponse>(`/brains/${brainId}/icp-rules/${ruleId}`, data),
    onSuccess: (response) => {
      queryClient.setQueryData(icpRuleKeys.detail(brainId, ruleId), response);
      queryClient.invalidateQueries({ queryKey: icpRuleKeys.lists(brainId) });
      toast({
        variant: 'success',
        title: 'Rule updated',
        description: 'The ICP rule has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to update rule',
        description: error.message || 'An unexpected error occurred.',
      });
    },
  });
}

/**
 * Delete an ICP rule with optimistic update
 */
export function useDeleteICPRule(brainId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ruleId: string) =>
      api.delete<DeleteICPRuleResponse>(`/brains/${brainId}/icp-rules/${ruleId}`),
    onMutate: async (ruleId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: icpRuleKeys.lists(brainId) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<{ rules: ICPRule[]; total: number }>(
        icpRuleKeys.list(brainId, {})
      );

      // Optimistically remove the rule
      if (previousData) {
        queryClient.setQueryData(icpRuleKeys.list(brainId, {}), {
          rules: previousData.rules.filter((r) => r.id !== ruleId),
          total: previousData.total - 1,
        });
      }

      return { previousData };
    },
    onError: (error: Error, _ruleId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(icpRuleKeys.list(brainId, {}), context.previousData);
      }
      toast({
        variant: 'destructive',
        title: 'Failed to delete rule',
        description: error.message || 'An unexpected error occurred.',
      });
    },
    onSuccess: (_, ruleId) => {
      queryClient.removeQueries({ queryKey: icpRuleKeys.detail(brainId, ruleId) });
      toast({
        variant: 'success',
        title: 'Rule deleted',
        description: 'The ICP rule has been deleted.',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: icpRuleKeys.lists(brainId) });
    },
  });
}

/**
 * Bulk import ICP rules
 */
export function useBulkImportICPRules(brainId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkImportICPRulesRequest) =>
      api.post<BulkImportICPRulesResponse>(`/brains/${brainId}/icp-rules/import`, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: icpRuleKeys.lists(brainId) });
      toast({
        variant: 'success',
        title: 'Rules imported',
        description: `Successfully imported ${response.imported} rules${response.skipped > 0 ? ` (${response.skipped} skipped)` : ''}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: error.message || 'An unexpected error occurred.',
      });
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get category badge color
 */
export function getCategoryColor(category: ICPCategory): string {
  switch (category) {
    case 'firmographic':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'technographic':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'behavioral':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'engagement':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: ICPCategory): string {
  switch (category) {
    case 'firmographic':
      return 'Firmographic';
    case 'technographic':
      return 'Technographic';
    case 'behavioral':
      return 'Behavioral';
    case 'engagement':
      return 'Engagement';
    default:
      return category;
  }
}

/**
 * Get operator display name
 */
export function getOperatorDisplayName(operator: RuleOperator): string {
  switch (operator) {
    case 'eq':
      return 'equals';
    case 'neq':
      return 'not equals';
    case 'gt':
      return 'greater than';
    case 'gte':
      return 'greater than or equal';
    case 'lt':
      return 'less than';
    case 'lte':
      return 'less than or equal';
    case 'contains':
      return 'contains';
    case 'not_contains':
      return 'does not contain';
    case 'in':
      return 'is one of';
    case 'not_in':
      return 'is not one of';
    case 'regex':
      return 'matches pattern';
    default:
      return operator;
  }
}

/**
 * Format condition value for display
 */
export function formatConditionValue(value: string | number | boolean | string[]): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}

/**
 * Format condition for display
 */
export function formatCondition(condition: RuleCondition): string {
  return `${getOperatorDisplayName(condition.operator)} ${formatConditionValue(condition.value)}`;
}

/**
 * Get weight color based on value
 */
export function getWeightColor(weight: number): string {
  if (weight >= 20) return 'text-green-600 dark:text-green-400';
  if (weight >= 10) return 'text-blue-600 dark:text-blue-400';
  if (weight > 0) return 'text-gray-600 dark:text-gray-400';
  if (weight > -10) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * All available categories
 */
export const ICP_CATEGORIES: ICPCategory[] = [
  'firmographic',
  'technographic',
  'behavioral',
  'engagement',
];

/**
 * All available operators
 */
export const RULE_OPERATORS: RuleOperator[] = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'in',
  'not_in',
  'regex',
];
