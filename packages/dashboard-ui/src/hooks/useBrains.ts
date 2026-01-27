/**
 * Brain management hooks
 * React Query hooks for fetching and managing brain data
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

// ============================================================================
// Types matching the API
// ============================================================================

export type BrainStatus = 'active' | 'draft' | 'archived';

export interface BrainConfig {
  vertical: string;
  target_roles: string[];
  target_company_sizes: string[];
  geo_focus: string[];
  custom_settings?: Record<string, unknown>;
}

export interface BrainStats {
  icp_rules_count: number;
  templates_count: number;
  handlers_count: number;
  research_docs_count: number;
  insights_count: number;
}

export interface Brain {
  brain_id: string;
  name: string;
  vertical: string;
  status: BrainStatus;
  config: BrainConfig;
  stats: BrainStats;
  created_at: string;
  updated_at: string;
}

export interface CreateBrainRequest {
  name: string;
  vertical: string;
  config?: Partial<BrainConfig>;
}

export interface UpdateBrainRequest {
  name?: string;
  config?: Partial<BrainConfig>;
}

// API Response types
interface BrainListResponse {
  success: true;
  brains: Brain[];
}

interface BrainResponse {
  success: true;
  brain: Brain;
}

interface BrainActivateResponse {
  success: true;
  brain: Brain;
  archived_brain_id: string | null;
}

// ============================================================================
// Query Key Factory
// ============================================================================

export const brainKeys = {
  all: ['brains'] as const,
  lists: () => [...brainKeys.all, 'list'] as const,
  list: (filters?: { status?: BrainStatus; vertical?: string }) =>
    [...brainKeys.lists(), filters] as const,
  details: () => [...brainKeys.all, 'detail'] as const,
  detail: (brainId: string) => [...brainKeys.details(), brainId] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch all brains with optional filtering
 */
export function useBrains(filters?: { status?: BrainStatus; vertical?: string }) {
  const searchParams = new URLSearchParams();
  if (filters?.status) searchParams.set('status', filters.status);
  if (filters?.vertical) searchParams.set('vertical', filters.vertical);
  const query = searchParams.toString();

  return useQuery({
    queryKey: brainKeys.list(filters),
    queryFn: () => api.get<BrainListResponse>(`/brains${query ? `?${query}` : ''}`),
    select: (data) => data.brains,
  });
}

/**
 * Fetch a single brain by ID
 */
export function useBrain(brainId: string | undefined) {
  return useQuery({
    queryKey: brainKeys.detail(brainId!),
    queryFn: () => api.get<BrainResponse>(`/brains/${brainId}`),
    select: (data) => data.brain,
    enabled: !!brainId,
  });
}

/**
 * Get the currently active brain
 */
export function useActiveBrain() {
  const { data: brains, ...rest } = useBrains({ status: 'active' });
  return {
    ...rest,
    data: brains?.[0] ?? null,
    brains,
  };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create a new brain
 */
export function useCreateBrain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBrainRequest) =>
      api.post<BrainResponse>('/brains', data),
    onSuccess: () => {
      // Invalidate brain lists to refetch
      queryClient.invalidateQueries({ queryKey: brainKeys.lists() });
    },
  });
}

/**
 * Update an existing brain
 */
export function useUpdateBrain(brainId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateBrainRequest) =>
      api.put<BrainResponse>(`/brains/${brainId}`, data),
    onSuccess: (response) => {
      // Update the cache for this brain
      queryClient.setQueryData(brainKeys.detail(brainId), response);
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: brainKeys.lists() });
    },
  });
}

/**
 * Activate a brain (and archive the currently active one)
 */
export function useActivateBrain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (brainId: string) =>
      api.post<BrainActivateResponse>(`/brains/${brainId}/activate`),
    onSuccess: (response, brainId) => {
      // Update the activated brain in cache
      queryClient.setQueryData(brainKeys.detail(brainId), {
        success: true,
        brain: response.brain,
      });
      // If another brain was archived, invalidate it
      if (response.archived_brain_id) {
        queryClient.invalidateQueries({
          queryKey: brainKeys.detail(response.archived_brain_id),
        });
      }
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: brainKeys.lists() });
    },
  });
}

/**
 * Archive a brain
 */
export function useArchiveBrain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (brainId: string) =>
      api.post<BrainResponse>(`/brains/${brainId}/archive`),
    onSuccess: (response, brainId) => {
      // Update the archived brain in cache
      queryClient.setQueryData(brainKeys.detail(brainId), response);
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: brainKeys.lists() });
    },
  });
}

/**
 * Clone a brain
 */
export function useCloneBrain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ brainId, newName }: { brainId: string; newName: string }) =>
      api.post<BrainResponse>(`/brains/${brainId}/clone`, { name: newName }),
    onSuccess: () => {
      // Invalidate brain lists to refetch
      queryClient.invalidateQueries({ queryKey: brainKeys.lists() });
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get status badge color
 */
export function getBrainStatusColor(status: BrainStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'draft':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'archived':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get status display text
 */
export function getBrainStatusText(status: BrainStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'draft':
      return 'Draft';
    case 'archived':
      return 'Archived';
    default:
      return status;
  }
}

/**
 * Format brain stats for display
 */
export function formatBrainStats(stats: BrainStats): string {
  const parts: string[] = [];
  if (stats.icp_rules_count > 0) parts.push(`${stats.icp_rules_count} ICP rules`);
  if (stats.templates_count > 0) parts.push(`${stats.templates_count} templates`);
  if (stats.handlers_count > 0) parts.push(`${stats.handlers_count} handlers`);
  if (stats.research_docs_count > 0) parts.push(`${stats.research_docs_count} docs`);
  return parts.length > 0 ? parts.join(', ') : 'Empty';
}
