/**
 * Background analysis engine.
 *
 * Runs the SSE fetch in a global singleton so the analysis continues even when
 * the user navigates away from the page. When they return, the component
 * re-subscribes and picks up the latest state (including the final result).
 */

export type ResultParser = (data: Record<string, unknown>) => unknown;

const defaultResultParser: ResultParser = (data) => ({
  answers: (data.answers as Record<string, string>) || {},
  details: (data.details as Record<string, string>) || {},
  executiveSummary: data.executiveSummary as string | undefined,
  methodology: data.methodology as string | undefined,
  dnshAnalysis: data.dnshAnalysis as Record<string, string> | undefined,
  paiTable: data.paiTable as Array<Record<string, string>> | undefined,
  goodGovernanceAssessment: data.goodGovernanceAssessment as string | undefined,
});

export interface AnalysisState {
  status: 'idle' | 'uploading' | 'analyzing' | 'merging' | 'done' | 'error';
  progress: number; // 0–100
  message: string;
  completedChunks: number;
  totalChunks: number;
  result: unknown;
  error: string | null;
}

type Listener = (state: AnalysisState) => void;

const INITIAL_STATE: AnalysisState = {
  status: 'idle',
  progress: 0,
  message: '',
  completedChunks: 0,
  totalChunks: 0,
  result: null,
  error: null,
};

class AnalysisJob {
  private state: AnalysisState = { ...INITIAL_STATE };
  private listeners = new Set<Listener>();
  private abortController: AbortController | null = null;

  getState(): AnalysisState {
    return { ...this.state };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const snapshot = this.getState();
    for (const fn of this.listeners) {
      try {
        fn(snapshot);
      } catch {
        // ignore listener errors
      }
    }
  }

  private update(patch: Partial<AnalysisState>) {
    Object.assign(this.state, patch);
    this.emit();
  }

  abort() {
    this.abortController?.abort();
    this.abortController = null;
    this.update({ status: 'idle', progress: 0, message: '' });
  }

  reset() {
    this.abort();
    this.state = { ...INITIAL_STATE };
    this.emit();
  }

  isRunning(): boolean {
    return this.state.status === 'uploading' || this.state.status === 'analyzing' || this.state.status === 'merging';
  }

  async start(
    endpoint: string,
    files: File[],
    extraFormData?: Record<string, string>,
    resultParser?: ResultParser,
  ) {
    if (this.isRunning()) return;

    const parseResult = resultParser || defaultResultParser;

    this.state = { ...INITIAL_STATE };
    this.abortController = new AbortController();

    this.update({ status: 'uploading', progress: 2, message: 'Laddar upp och läser dokument' });

    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    if (extraFormData) {
      for (const [key, value] of Object.entries(extraFormData)) {
        if (value != null && value !== '') formData.append(key, value);
      }
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'text/event-stream' },
        signal: this.abortController.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText || 'Analys misslyckades');
      }

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') && res.body) {
        this.update({ status: 'analyzing', progress: 8, message: 'Analyserar dokument' });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            fullText += decoder.decode(value, { stream: !done });
          }

          let idx: number;
          while ((idx = fullText.indexOf('\n\n')) !== -1) {
            const block = fullText.slice(0, idx).trim();
            fullText = fullText.slice(idx + 2);
            if (!block) continue;

            let eventName = '';
            let dataStr = '';
            for (const line of block.split('\n')) {
              if (line.startsWith('event: ')) eventName = line.slice(7).trim();
              else if (line.startsWith('data: ')) dataStr = line.slice(6);
            }
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              if (eventName === 'progress') {
                const total = data.total || 1;
                const completed = data.completed || 0;
                const step = data.step as string;

                let pct: number;
                if (step === 'start') {
                  pct = 8;
                } else if (step === 'merge') {
                  pct = 90;
                } else {
                  pct = 8 + Math.round((completed / total) * 80);
                }

                this.update({
                  status: step === 'merge' ? 'merging' : 'analyzing',
                  progress: pct,
                  message: data.message || 'Analyserar',
                  completedChunks: completed,
                  totalChunks: total,
                });
              } else if (eventName === 'rejection') {
                this.update({
                  status: 'done',
                  progress: 100,
                  message: 'Ej godkänd',
                  result: { earlyRejection: data },
                });
              } else if (eventName === 'result') {
                this.update({
                  status: 'done',
                  progress: 100,
                  message: 'Klar',
                  result: parseResult(data),
                });
              } else if (eventName === 'error') {
                throw new Error(data.error || 'Analys misslyckades');
              }
            } catch (parseErr) {
              if (eventName === 'error') throw parseErr;
            }
          }

          if (done) break;
        }

        if (this.state.status !== 'done') {
          this.update({
            status: 'error',
            progress: 0,
            message: '',
            error: 'Analysen avslutades utan resultat.',
          });
        }
      } else {
        this.update({ status: 'analyzing', progress: 50, message: 'Analyserar dokument' });
        const data = await res.json();
        if (data.earlyRejection) {
          this.update({
            status: 'done',
            progress: 100,
            message: 'Ej godkänd',
            result: { earlyRejection: data.earlyRejection },
          });
        } else {
          this.update({
            status: 'done',
            progress: 100,
            message: 'Klar',
            result: parseResult(data),
          });
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.update({ status: 'idle', progress: 0, message: '' });
        return;
      }
      this.update({
        status: 'error',
        progress: 0,
        message: '',
        error: err instanceof Error ? err.message : 'Analys misslyckades',
      });
    } finally {
      this.abortController = null;
    }
  }
}

// Global singleton map – one job per form type
const jobs = new Map<string, AnalysisJob>();

export function getAnalysisJob(formType: string): AnalysisJob {
  let job = jobs.get(formType);
  if (!job) {
    job = new AnalysisJob();
    jobs.set(formType, job);
  }
  return job;
}
