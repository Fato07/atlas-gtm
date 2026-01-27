/**
 * useActions hook
 * Handles manual agent action triggers from the dashboard
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

interface ScoreLeadParams {
  email: string;
  brain_id: string;
  force_rescore?: boolean;
}

interface GenerateBriefParams {
  email: string;
  brain_id: string;
  meeting_time?: string;
  force_regenerate?: boolean;
}

interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
  code?: string;
}

/**
 * Hook for manual action triggers
 */
export function useActions() {
  const queryClient = useQueryClient();

  /**
   * Trigger lead scoring for a specific email
   */
  const scoreLead = useMutation({
    mutationFn: async (params: ScoreLeadParams) => {
      const response = await api.post<ActionResult>('/actions/score-lead', params);

      if (!response.success) {
        throw new Error(response.error || 'Failed to trigger lead scoring');
      }

      return response;
    },
    onSuccess: () => {
      // Invalidate activity feed to show the new action
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      // Invalidate metrics to update lead count
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });

  /**
   * Trigger meeting brief generation
   */
  const generateBrief = useMutation({
    mutationFn: async (params: GenerateBriefParams) => {
      const response = await api.post<ActionResult>('/actions/generate-brief', params);

      if (!response.success) {
        throw new Error(response.error || 'Failed to trigger brief generation');
      }

      return response;
    },
    onSuccess: () => {
      // Invalidate activity feed to show the new action
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      // Invalidate metrics to update brief count
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });

  return {
    scoreLead,
    generateBrief,
    isLoading: scoreLead.isPending || generateBrief.isPending,
  };
}

export type { ScoreLeadParams, GenerateBriefParams, ActionResult };
