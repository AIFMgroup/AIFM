'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAnalysisJob, type AnalysisState, type ResultParser } from './background-analysis';

/**
 * Hook that connects a component to a background analysis job.
 * The analysis continues even if the component unmounts (user navigates away).
 * When the component remounts, it picks up the latest state.
 */
export function useBackgroundAnalysis(formType: string) {
  const [state, setState] = useState<AnalysisState>(() => getAnalysisJob(formType).getState());
  const resultParserRef = useRef<ResultParser | undefined>(undefined);

  useEffect(() => {
    const job = getAnalysisJob(formType);
    const unsub = job.subscribe(setState);
    return unsub;
  }, [formType]);

  const startAnalysis = useCallback(
    (endpoint: string, files: File[], extraFormData?: Record<string, string>, resultParser?: ResultParser) => {
      resultParserRef.current = resultParser;
      const job = getAnalysisJob(formType);
      job.start(endpoint, files, extraFormData, resultParser);
    },
    [formType],
  );

  const abort = useCallback(() => {
    getAnalysisJob(formType).abort();
  }, [formType]);

  const reset = useCallback(() => {
    getAnalysisJob(formType).reset();
  }, [formType]);

  const consumeResult = useCallback(<T = { answers: Record<string, string>; details: Record<string, string> }>(): T | null => {
    const job = getAnalysisJob(formType);
    const s = job.getState();
    if (s.status === 'done' && s.result) {
      const result = s.result as T;
      job.reset();
      return result;
    }
    return null;
  }, [formType]);

  return {
    ...state,
    isRunning: state.status === 'uploading' || state.status === 'analyzing' || state.status === 'merging',
    isDone: state.status === 'done',
    isError: state.status === 'error',
    startAnalysis,
    abort,
    reset,
    consumeResult,
  };
}
