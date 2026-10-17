import { visitWavWindows, type AudioMetadata, type WavWindow } from './audioModel';

export interface AnalysisOptions {
    start: number; end: number; viewStart: number; viewEnd: number;
    fftSize: number; channels: number[]; minFrequency: number; maxFrequency: number; logarithmic: boolean;
}
export interface AnalysisResult {
    metadata: AudioMetadata; start: number; end: number; viewStart: number; viewEnd: number;
    fftSize: number; windowFrames: number; spectrumFrames: number; spectrogramFrames: number; rows: number;
    minFrequency: number; maxFrequency: number; logarithmic: boolean; channels: number[];
    spectrum: Float32Array[]; spectrogram: Float32Array[];
    modulation: Float32Array[]; modulationStep: number; modulationStart: number; modulationEnd: number;
}
const db = (amplitude: number) => Math.max(-140, 20 * Math.log10(Math.max(1e-7, amplitude)));
const powerOfTwo = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));

/** In-place radix-2 FFT. Inverse includes 1/N scaling. */
export function fft(real: Float64Array, imaginary: Float64Array, inverse = false) {
    const n = real.length;
    if (n !== imaginary.length || n < 2 || (n & (n - 1))) throw new Error('invalidFFT');
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { [real[i], real[j]] = [real[j], real[i]]; [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]]; }
    }
    for (let length = 2; length <= n; length *= 2) {
        const angle = (inverse ? 2 : -2) * Math.PI / length, wr = Math.cos(angle), wi = Math.sin(angle);
        for (let offset = 0; offset < n; offset += length) {
            let r = 1, im = 0;
            for (let j = 0; j < length / 2; j++) {
                const a = offset + j, b = a + length / 2;
                const tr = r * real[b] - im * imaginary[b], ti = r * imaginary[b] + im * real[b];
                real[b] = real[a] - tr; imaginary[b] = imaginary[a] - ti;
                real[a] += tr; imaginary[a] += ti;
                const next = r * wr - im * wi; im = r * wi + im * wr; r = next;
            }
        }
    }
    if (inverse) for (let i = 0; i < n; i++) { real[i] /= n; imaginary[i] /= n; }
}

/** Hann coherent-gain corrected, one-sided sine peak amplitude (full scale = 1). */
export function amplitudeSpectrum(samples: Float32Array | Float64Array, size: number) {
    const real = new Float64Array(size), imaginary = new Float64Array(size);
    const count = Math.min(size, samples.length);
    let gain = 0;
    for (let i = 0; i < count; i++) {
        const weight = count < 3 ? 1 : .5 - .5 * Math.cos(2 * Math.PI * i / (count - 1));
        gain += weight; real[i] = samples[i] * weight;
    }
    fft(real, imaginary);
    const amplitudes = new Float64Array(size / 2 + 1);
    for (let i = 0; i < amplitudes.length; i++) amplitudes[i] = Math.hypot(real[i], imaginary[i]) * (i === 0 || i === size / 2 ? 1 : 2) / gain;
    return amplitudes;
}

/** Band-limited Hilbert envelope, trimmed at both edges, DC removed, relative to mean envelope. */
export function modulationSpectrum(samples: Float32Array, sampleRate: number, min: number, max: number) {
    const size = powerOfTwo(samples.length), real = new Float64Array(size), imaginary = new Float64Array(size);
    real.set(samples); fft(real, imaginary);
    for (let i = 0; i < size; i++) {
        const frequency = i * sampleRate / size;
        const factor = i > 0 && i <= size / 2 && frequency >= min && frequency <= max ? (i === size / 2 ? 1 : 2) : 0;
        real[i] *= factor; imaginary[i] *= factor;
    }
    fft(real, imaginary, true);
    const trim = Math.min(Math.floor(sampleRate * .05), Math.floor(samples.length / 20));
    const envelope = new Float64Array(samples.length - 2 * trim);
    let mean = 0;
    for (let i = 0; i < envelope.length; i++) { envelope[i] = Math.hypot(real[i + trim], imaginary[i + trim]); mean += envelope[i]; }
    mean /= envelope.length;
    for (let i = 0; i < envelope.length; i++) envelope[i] = mean > 1e-7 ? (envelope[i] - mean) / mean : 0;
    const envelopeSize = powerOfTwo(envelope.length), spectrum = amplitudeSpectrum(envelope, envelopeSize);
    const step = sampleRate / envelopeSize;
    return { values: Float32Array.from(spectrum.subarray(0, Math.min(spectrum.length, Math.floor(120 / step) + 1)), db), step, trim };
}

export function frequencyAt(fraction: number, min: number, max: number, logarithmic: boolean) {
    return logarithmic ? min * (max / min) ** fraction : min + fraction * (max - min);
}

export async function analyzeWav(stream: ReadableStream<Uint8Array>, options: AnalysisOptions, progress: (value: number) => void = () => {}) {
    if (![2048, 8192, 32768, 65536].includes(options.fftSize) || ![options.start, options.end, options.viewStart, options.viewEnd, options.minFrequency, options.maxFrequency].every(Number.isFinite)) throw new Error('invalidRange');
    type Task = WavWindow & { kind: 'spectrum' | 'spectrogram' | 'modulation'; column?: number };
    const tasks: Task[] = [];
    let result: AnalysisResult;
    let power: Float64Array[];
    await visitWavWindows(stream, options.channels, metadata => {
        const rate = metadata.sampleRate, frames = Math.round(metadata.duration * rate);
        const start = Math.max(0, Math.min(frames - 1, Math.floor(options.start * rate)));
        const end = Math.min(frames, Math.max(start + 1, Math.ceil(options.end * rate)));
        const viewStart = Math.max(0, Math.min(frames - 1, Math.floor(options.viewStart * rate)));
        const viewEnd = Math.min(frames, Math.max(viewStart + 1, Math.ceil(options.viewEnd * rate)));
        const windowFrames = Math.min(options.fftSize, end - start), size = Math.min(options.fftSize, powerOfTwo(windowFrames));
        const spectrumFrames = Math.min(64, Math.max(1, Math.ceil((end - start - windowFrames) / Math.max(1, windowFrames / 2)) + 1));
        const spectrogramWindow = Math.min(size, viewEnd - viewStart);
        const spectrogramFrames = Math.min(160, Math.max(1, Math.ceil((viewEnd - viewStart) / Math.max(1, spectrogramWindow / 2))));
        const min = Math.max(options.logarithmic ? 1 : 0, options.minFrequency), max = Math.min(rate / 2, options.maxFrequency);
        if (max <= min) throw new Error('invalidRange');
        const modulationFrames = Math.min(end - start, Math.floor(rate * 8), 524288);
        result = { metadata, start: start / rate, end: end / rate, viewStart: viewStart / rate, viewEnd: viewEnd / rate,
            fftSize: size, windowFrames, spectrumFrames, spectrogramFrames, rows: 256, minFrequency: min, maxFrequency: max,
            logarithmic: options.logarithmic, channels: options.channels,
            spectrum: [], spectrogram: options.channels.map(() => new Float32Array(spectrogramFrames * 256)),
            modulation: [], modulationStep: 0, modulationStart: start / rate, modulationEnd: (start + modulationFrames) / rate };
        power = options.channels.map(() => new Float64Array(size / 2 + 1));
        for (let i = 0; i < spectrumFrames; i++) tasks.push({ kind: 'spectrum', start: start + Math.round(i / Math.max(1, spectrumFrames - 1) * (end - start - windowFrames)), frames: windowFrames });
        for (let i = 0; i < spectrogramFrames; i++) tasks.push({ kind: 'spectrogram', column: i, start: viewStart + Math.round(i / Math.max(1, spectrogramFrames - 1) * (viewEnd - viewStart - spectrogramWindow)), frames: spectrogramWindow });
        tasks.push({ kind: 'modulation', start, frames: modulationFrames });
        tasks.sort((a, b) => a.start - b.start || b.frames - a.frames);
        return tasks;
    }, (channels, _window, index) => {
        const task = tasks[index], rate = result.metadata.sampleRate;
        channels.forEach((samples, channel) => {
            if (task.kind === 'modulation') {
                const modulation = modulationSpectrum(samples, rate, result.minFrequency, result.maxFrequency);
                result.modulation[channel] = modulation.values; result.modulationStep = modulation.step;
                result.modulationStart = task.start / rate + modulation.trim / rate;
                result.modulationEnd = (task.start + task.frames - modulation.trim) / rate;
                return;
            }
            const amplitude = amplitudeSpectrum(samples, result.fftSize);
            if (task.kind === 'spectrum') for (let i = 0; i < amplitude.length; i++) power[channel][i] += amplitude[i] ** 2 / result.spectrumFrames;
            else for (let row = 0; row < result.rows; row++) {
                const low = frequencyAt(row / result.rows, result.minFrequency, result.maxFrequency, result.logarithmic) * result.fftSize / rate;
                const high = frequencyAt((row + 1) / result.rows, result.minFrequency, result.maxFrequency, result.logarithmic) * result.fftSize / rate;
                const first = Math.min(amplitude.length - 1, Math.max(0, Math.ceil(low)));
                const last = Math.min(amplitude.length - 1, Math.max(first, Math.floor(high)));
                let peak = 0;
                for (let i = first; i <= last; i++) peak = Math.max(peak, amplitude[i]);
                result.spectrogram[channel][task.column! * result.rows + row] = db(peak);
            }
        });
        progress((index + 1) / tasks.length);
    });
    result!.spectrum = power!.map(values => Float32Array.from(values, value => db(Math.sqrt(value))));
    return result!;
}
