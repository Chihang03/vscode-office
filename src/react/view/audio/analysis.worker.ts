import { analyzeWav } from './spectralModel';
self.onmessage = async ({ data }: MessageEvent) => {
    try {
        let last = 0;
        const result = await analyzeWav(data.stream, data.options, progress => {
            if (Date.now() - last > 100) { last = Date.now(); self.postMessage({ type: 'progress', progress }); }
        });
        const transfer = [...result.spectrum, ...result.spectrogram, ...result.modulation].map(values => values.buffer as ArrayBuffer);
        self.postMessage({ type: 'ready', result }, { transfer });
    } catch (error) { self.postMessage({ type: 'error', error: error instanceof Error ? error.message : 'readFailed' }); }
};
