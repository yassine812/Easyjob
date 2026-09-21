'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { aiApi } from '@/lib/api/ai';
import type { AiAnalysis } from '@/types/api';

/**
 * Polls an AI analysis every 2.5s until it reaches a terminal state
 * (COMPLETED / FAILED). Also refetches the analyses list on completion.
 */
export function useAiAnalysis(analysisId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ai-analysis', analysisId],
    queryFn: () => aiApi.analysis(analysisId!),
    enabled: !!analysisId,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === 'COMPLETED' || status === 'FAILED') return false;
      return 2500;
    },
  });

  const analysis = query.data as AiAnalysis | undefined;

  useEffect(() => {
    if (analysis && (analysis.status === 'COMPLETED' || analysis.status === 'FAILED')) {
      queryClient.invalidateQueries({ queryKey: ['ai-analyses'] });
    }
  }, [analysis, queryClient]);

  return { ...query, analysis };
}
