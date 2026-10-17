import { useEffect, useRef, useState } from 'react';
import AnalysisWorker from './analysis.worker?worker&inline';
import type { AnalysisOptions, AnalysisResult } from './spectralModel';

export function useAudioAnalysis(url: string, version: string, options: AnalysisOptions, enabled: boolean) {
    const [state, setState] = useState<{ status: string; progress: number; result?: AnalysisResult; error?: string }>({ status: 'idle', progress: 0 });
    const [retry, setRetry] = useState(0), stop = useRef<() => void>(() => {});
    const cache = useRef(new Map<string, AnalysisResult>());
    const key = JSON.stringify(options);
    useEffect(() => {
        if (!enabled) return;
        let disposed = false, worker: Worker | undefined;
        const controller = new AbortController();
        const cancel = () => { disposed = true; controller.abort(); worker?.terminate(); };
        stop.current = () => { cancel(); setState({ status: 'cancelled', progress: 0 }); };
        const cacheKey = version + key;
        const cached = cache.current.get(cacheKey);
        if (cached) { setState({ status: 'ready', progress: 1, result: cached }); return cancel; }
        setState(current => ({ status: 'loading', progress: 0, result: current.result }));
        const timer = setTimeout(() => { void (async () => {
            try {
                const response = await fetch(url, { signal: controller.signal });
                if (!response.ok || !response.body) throw new Error('readFailed');
                if (disposed) { await response.body.cancel(); return; }
                worker = new AnalysisWorker();
                worker.onmessage = ({ data }) => {
                    if (disposed) return;
                    if (data.type === 'progress') setState(current => ({ status: 'loading', progress: data.progress, result: current.result }));
                    else if (data.type === 'ready') {
                        cache.current.set(cacheKey, data.result);
                        while (cache.current.size > 3) cache.current.delete(cache.current.keys().next().value!);
                        setState({ status: 'ready', progress: 1, result: data.result }); worker?.terminate();
                    } else { setState({ status: 'error', progress: 0, error: data.error }); worker?.terminate(); }
                };
                worker.onerror = () => { if (!disposed) setState({ status: 'error', progress: 0, error: 'readFailed' }); worker?.terminate(); };
                worker.postMessage({ stream: response.body, options: JSON.parse(key) }, [response.body]);
            } catch (error) { if (!disposed) setState({ status: 'error', progress: 0, error: error instanceof Error ? error.message : 'readFailed' }); }
        })(); }, 250);
        return () => { clearTimeout(timer); cancel(); };
    }, [url, version, key, enabled, retry]);
    return { ...state, cancel: () => stop.current(), retry: () => setRetry(value => value + 1) };
}
