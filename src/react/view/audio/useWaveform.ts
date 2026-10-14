import { useEffect, useState } from 'react';
import WaveformWorker from './waveform.worker?worker&inline';
import type { AudioResource, WaveformData, AudioMetadata } from './audioModel';
import { getWaveform, putWaveform } from './waveformCache';

export function useWaveform(resource: AudioResource, url: string, mediaDuration: number, mediaFailed: boolean) {
    const [data, setData] = useState<WaveformData>();
    const [metadata, setMetadata] = useState<AudioMetadata>();
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [cancelled, setCancelled] = useState(false);
    const wav = ['.wav', '.wave'].includes(resource.ext);
    const readyDuration = wav ? 0 : mediaDuration;
    useEffect(() => {
        if (!url || cancelled) return;
        if (!wav && mediaFailed) { setStatus('error'); setError('decodeFailed'); return; }
        if (!wav && !readyDuration) return;
        let disposed = false, worker: Worker | undefined, context: AudioContext | undefined;
        const abort = new AbortController();
        const finish = (value: WaveformData, cached = false) => {
            if (disposed) return;
            setData(value); setMetadata(value.metadata); setProgress(1); setStatus(cached ? 'cached' : 'ready');
            if (!cached) void putWaveform(resource.version, value);
        };
        const runWorker = (message, transfers: Transferable[] = []) => new Promise<WaveformData>((resolve, reject) => {
            worker = new WaveformWorker();
            worker.onmessage = ({ data: result }) => {
                if (disposed) return;
                if (result.type === 'progress') { setProgress(result.progress); if (result.metadata) setMetadata(result.metadata); }
                if (result.type === 'ready') { resolve(result.summary); worker?.terminate(); worker = undefined; }
                if (result.type === 'error') { reject(new Error(result.error)); worker?.terminate(); worker = undefined; }
            };
            worker.onerror = () => { reject(new Error('readFailed')); worker?.terminate(); worker = undefined; };
            worker.postMessage(message, transfers);
        });
        const decode = async () => {
            // Browser decoding needs the whole encoded file and can consume much more memory than its file size.
            if ((resource.size ?? 0) > 32 * 1024 * 1024 || (readyDuration > 0 && readyDuration * 48000 * 2 * 4 > 128 * 1024 * 1024)) throw new Error('tooLarge');
            const response = await fetch(url, { signal: abort.signal });
            if (!response.ok) throw new Error('readFailed');
            const declaredSize = Number(response.headers.get('Content-Length'));
            if (declaredSize > 32 * 1024 * 1024) throw new Error('tooLarge');
            const reader = response.body?.getReader();
            if (!reader) throw new Error('readFailed');
            const chunks: Uint8Array[] = []; let length = 0;
            try {
                while (true) {
                    const next = await reader.read(); if (next.done) break;
                    length += next.value.length;
                    if (length > 32 * 1024 * 1024) throw new Error('tooLarge');
                    chunks.push(next.value);
                }
            } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
            if (disposed) return;
            const bytes = new Uint8Array(length); let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
            context = new AudioContext();
            const decoded = await context.decodeAudioData(bytes.buffer);
            await context.close(); context = undefined;
            if (disposed) return;
            if (decoded.length * decoded.numberOfChannels * 4 > 128 * 1024 * 1024) throw new Error('tooLarge');
            const channels = Array.from({ length: Math.min(8, decoded.numberOfChannels) }, (_, channel) => decoded.getChannelData(channel).slice());
            const waveform = await runWorker({ kind: 'samples', channels, sampleRate: decoded.sampleRate }, channels.map(channel => channel.buffer));
            waveform.metadata.channels = decoded.numberOfChannels;
            return waveform;
        };
        void (async () => {
            try {
                const cached = await getWaveform(resource.version);
                if (disposed) return;
                if (cached) { finish(cached, true); return; }
                let result: WaveformData | undefined;
                if (['.wav', '.wave'].includes(resource.ext)) {
                    try {
                        // VS Code resource URLs are served by the page's service worker. A blob worker
                        // cannot fetch them reliably; transfer the page-owned stream without buffering PCM.
                        const response = await fetch(url, { signal: abort.signal });
                        if (!response.ok || !response.body) throw new Error('readFailed');
                        if (disposed) { await response.body.cancel(); return; }
                        result = await runWorker({ kind: 'wav', stream: response.body }, [response.body]);
                    }
                    catch (e) { if (e.message !== 'unsupportedWav') throw e; result = await decode(); }
                } else result = await decode();
                if (result) finish(result);
            } catch (e) {
                if (disposed) return;
                setError(['tooLarge', 'empty', 'incomplete', 'invalidSamples', 'readFailed'].includes(e.message) ? e.message : 'decodeFailed'); setStatus('error');
            }
        })();
        return () => { disposed = true; abort.abort(); worker?.terminate(); if (context && context.state !== 'closed') void context.close().catch(() => {}); };
        // Duration is a preflight check once available; do not restart streamed workers on media events.
    }, [url, resource.version, resource.size, readyDuration, wav, cancelled, mediaFailed]);
    return { data, metadata, progress, status: cancelled && !data ? 'cancelled' : status, error, cancel: () => setCancelled(true) };
}
