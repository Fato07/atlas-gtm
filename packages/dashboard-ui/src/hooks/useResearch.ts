/**
 * React Query hooks for Market Research management
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api } from '@/services/api';
import { toast } from '@/components/ui/toast';

// ============================================================================
// Types
// ============================================================================

export type ContentType = 'article' | 'report' | 'transcript' | 'notes' | 'other';
export type DocumentStatus = 'active' | 'archived';

export interface MarketResearch {
  id: string;
  brain_id: string;
  title: string;
  content_type: ContentType;
  content: string;
  key_facts: string[];
  source: string | null;
  source_url: string | null;
  tags: string[];
  status: DocumentStatus;
  created_at: string;
}

export interface CreateResearchRequest {
  title: string;
  content_type: ContentType;
  content: string;
  source?: string;
  source_url?: string;
  tags?: string[];
}

export interface UpdateResearchRequest {
  title?: string;
  content?: string;
  key_facts?: string[];
  tags?: string[];
  status?: DocumentStatus;
}

export interface ListResearchParams {
  content_type?: ContentType;
  status?: DocumentStatus;
  tags?: string;
  search?: string;
}

// ============================================================================
// Query Keys
// ============================================================================

export const researchKeys = {
  all: ['research'] as const,
  lists: () => [...researchKeys.all, 'list'] as const,
  list: (brainId: string, params?: ListResearchParams) =>
    [...researchKeys.lists(), brainId, params ?? {}] as const,
  details: () => [...researchKeys.all, 'detail'] as const,
  detail: (brainId: string, docId: string) =>
    [...researchKeys.details(), brainId, docId] as const,
  tags: (brainId: string) => [...researchKeys.all, 'tags', brainId] as const,
};

// ============================================================================
// API Functions
// ============================================================================

async function fetchResearch(
  brainId: string,
  params?: ListResearchParams
): Promise<{ documents: MarketResearch[]; total: number }> {
  const queryParams = new URLSearchParams();
  if (params?.content_type) queryParams.set('content_type', params.content_type);
  if (params?.status) queryParams.set('status', params.status);
  if (params?.tags) queryParams.set('tags', params.tags);
  if (params?.search) queryParams.set('search', params.search);

  const queryString = queryParams.toString();
  const url = `/brains/${brainId}/research${queryString ? `?${queryString}` : ''}`;

  const response = await api.get<{
    success: boolean;
    documents: MarketResearch[];
    total: number;
  }>(url);

  return { documents: response.documents, total: response.total };
}

async function fetchResearchById(
  brainId: string,
  docId: string
): Promise<MarketResearch> {
  const response = await api.get<{ success: boolean; document: MarketResearch }>(
    `/brains/${brainId}/research/${docId}`
  );
  return response.document;
}

async function fetchResearchTags(brainId: string): Promise<string[]> {
  const response = await api.get<{ success: boolean; tags: string[] }>(
    `/brains/${brainId}/research/tags`
  );
  return response.tags;
}

async function createResearch(
  brainId: string,
  data: CreateResearchRequest
): Promise<MarketResearch> {
  const response = await api.post<{
    success: boolean;
    document: MarketResearch;
    extracted_facts_count: number;
  }>(`/brains/${brainId}/research`, data);
  return response.document;
}

async function updateResearch(
  brainId: string,
  docId: string,
  data: UpdateResearchRequest
): Promise<MarketResearch> {
  const response = await api.patch<{
    success: boolean;
    document: MarketResearch;
  }>(`/brains/${brainId}/research/${docId}`, data);
  return response.document;
}

async function archiveResearch(
  brainId: string,
  docId: string
): Promise<MarketResearch> {
  const response = await api.post<{
    success: boolean;
    document: MarketResearch;
  }>(`/brains/${brainId}/research/${docId}/archive`, {});
  return response.document;
}

async function deleteResearch(brainId: string, docId: string): Promise<void> {
  await api.delete<{ success: boolean; deleted_id: string }>(
    `/brains/${brainId}/research/${docId}`
  );
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch research documents for a brain
 */
export function useResearch(
  brainId: string | undefined,
  params?: ListResearchParams,
  options?: Omit<UseQueryOptions<{ documents: MarketResearch[]; total: number }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: researchKeys.list(brainId ?? '', params),
    queryFn: () => fetchResearch(brainId!, params),
    enabled: !!brainId,
    ...options,
  });
}

/**
 * Fetch a single research document
 */
export function useResearchDetail(
  brainId: string | undefined,
  docId: string | undefined
) {
  return useQuery({
    queryKey: researchKeys.detail(brainId ?? '', docId ?? ''),
    queryFn: () => fetchResearchById(brainId!, docId!),
    enabled: !!brainId && !!docId,
  });
}

/**
 * Fetch all tags for a brain's research
 */
export function useResearchTags(brainId: string | undefined) {
  return useQuery({
    queryKey: researchKeys.tags(brainId ?? ''),
    queryFn: () => fetchResearchTags(brainId!),
    enabled: !!brainId,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create a new research document
 */
export function useCreateResearch(brainId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateResearchRequest) => createResearch(brainId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: researchKeys.lists() });
      queryClient.invalidateQueries({ queryKey: researchKeys.tags(brainId) });
      toast({
        variant: 'success',
        title: 'Research created',
        description: 'The research document has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to create research',
        description: error.message || 'An unexpected error occurred.',
      });
    },
  });
}

/**
 * Update a research document
 */
export function useUpdateResearch(brainId: string, docId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateResearchRequest) =>
      updateResearch(brainId, docId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: researchKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: researchKeys.detail(brainId, docId),
      });
      queryClient.invalidateQueries({ queryKey: researchKeys.tags(brainId) });
      toast({
        variant: 'success',
        title: 'Research updated',
        description: 'The research document has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to update research',
        description: error.message || 'An unexpected error occurred.',
      });
    },
  });
}

/**
 * Archive a research document
 */
export function useArchiveResearch(brainId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (docId: string) => archiveResearch(brainId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: researchKeys.lists() });
      toast({
        variant: 'success',
        title: 'Research archived',
        description: 'The research document has been archived.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to archive research',
        description: error.message || 'An unexpected error occurred.',
      });
    },
  });
}

/**
 * Delete a research document
 */
export function useDeleteResearch(brainId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (docId: string) => deleteResearch(brainId, docId),
    onMutate: async (docId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: researchKeys.lists() });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<{
        documents: MarketResearch[];
        total: number;
      }>(researchKeys.list(brainId, {}));

      // Optimistically remove the document
      if (previousData) {
        queryClient.setQueryData(researchKeys.list(brainId, {}), {
          documents: previousData.documents.filter((d) => d.id !== docId),
          total: previousData.total - 1,
        });
      }

      return { previousData };
    },
    onError: (error: Error, _docId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(researchKeys.list(brainId, {}), context.previousData);
      }
      toast({
        variant: 'destructive',
        title: 'Failed to delete research',
        description: error.message || 'An unexpected error occurred.',
      });
    },
    onSuccess: () => {
      toast({
        variant: 'success',
        title: 'Research deleted',
        description: 'The research document has been deleted.',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: researchKeys.lists() });
      queryClient.invalidateQueries({ queryKey: researchKeys.tags(brainId) });
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get display name for content type
 */
export function getContentTypeDisplayName(type: ContentType): string {
  const names: Record<ContentType, string> = {
    article: 'Article',
    report: 'Report',
    transcript: 'Transcript',
    notes: 'Notes',
    other: 'Other',
  };
  return names[type];
}

/**
 * Get display name for document status
 */
export function getStatusDisplayName(status: DocumentStatus): string {
  const names: Record<DocumentStatus, string> = {
    active: 'Active',
    archived: 'Archived',
  };
  return names[status];
}

/**
 * Get color class for content type badge
 */
export function getContentTypeColor(type: ContentType): string {
  const colors: Record<ContentType, string> = {
    article: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    report: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    transcript: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    notes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  };
  return colors[type];
}

/**
 * Get color class for document status badge
 */
export function getStatusColor(status: DocumentStatus): string {
  const colors: Record<DocumentStatus, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  };
  return colors[status];
}

/**
 * Get icon for content type
 */
export function getContentTypeIcon(type: ContentType): string {
  const icons: Record<ContentType, string> = {
    article: 'FileText',
    report: 'BarChart2',
    transcript: 'MessageSquare',
    notes: 'StickyNote',
    other: 'File',
  };
  return icons[type];
}

/**
 * Format date for display
 */
export function formatResearchDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get word count from content
 */
export function getWordCount(content: string): number {
  return content.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Get reading time estimate (words / 200 wpm)
 */
export function getReadingTime(content: string): string {
  const words = getWordCount(content);
  const minutes = Math.ceil(words / 200);
  return `${minutes} min read`;
}
