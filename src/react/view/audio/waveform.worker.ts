import { readWavWaveform, buildDecodedWaveform } from './audioModel';

self.onmessage = async (event: MessageEvent) => {
    try {
        let lastProgress = 0;
        const summary = event.data.kind === 'samples'
            ? buildDecodedWaveform(event.data.channels, event.data.sampleRate)
            : await readWavWaveform(event.data.stream, (progress, metadata) => {
                if (metadata || Date.now() - lastProgress > 100) {
                    lastProgress = Date.now(); self.postMessage({ type: 'progress', progress, metadata });
                }
            });
        self.postMessage({ type: 'ready', summary }, { transfer: summary.peaks.map(channel => channel.buffer as ArrayBuffer) });
    } catch (error) {
        self.postMessage({ type: 'error', error: error instanceof Error ? error.message : 'readFailed' });
    }
};
