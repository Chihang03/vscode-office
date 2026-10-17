import type { AudioAnalysisSettings } from '../../../common/audioAnalysisSettings';
export interface AudioResource {
    id: string; version: string; fileName: string; ext: string; mime: string;
    analysisSettings?: AudioAnalysisSettings; size?: number; src?: string; buffer?: number[]; resumeTime?: number; error?: string;
}
export interface AudioMetadata {
    sampleRate: number; channels: number; bits?: number; encoding: string;
    original: boolean; duration: number;
}
export interface WaveformData {
    metadata: AudioMetadata; peaks: Float32Array[]; bins: number;
}
export interface TimeView { zoom: number; start: number }
export type Selection = { start: number; end: number } | null;

export function clampView(view: TimeView, duration: number): TimeView {
    const zoom = Math.max(1, Math.min(32, view.zoom));
    return { zoom, start: Math.max(0, Math.min(Math.max(0, duration - duration / zoom), view.start)) };
}
export function formatTime(time: number) {
    const millis = Math.max(0, Math.round((Number.isFinite(time) ? time : 0) * 1000));
    const hours = Math.floor(millis / 3600000);
    const mins = Math.floor(millis / 60000) % 60;
    const secs = Math.floor(millis / 1000) % 60;
    return `${hours ? `${hours}:` : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis % 1000).padStart(3, '0')}`;
}

class ByteReader {
    private bytes: Uint8Array = new Uint8Array(0);
    private offset = 0;
    public consumed = 0;
    constructor(private reader: ReadableStreamDefaultReader<Uint8Array>) {}
    async chunk(): Promise<Uint8Array | null> {
        if (this.offset < this.bytes.length) {
            const chunk = this.bytes.subarray(this.offset); this.offset = this.bytes.length; this.consumed += chunk.length; return chunk;
        }
        const result = await this.reader.read();
        if (result.done) return null;
        this.consumed += result.value.length;
        return result.value;
    }
    async take(length: number): Promise<Uint8Array> {
        const result = new Uint8Array(length);
        let done = 0;
        while (done < length) {
            if (this.offset === this.bytes.length) {
                const next = await this.reader.read();
                if (next.done) throw new Error('incomplete');
                this.bytes = next.value; this.offset = 0;
            }
            const count = Math.min(length - done, this.bytes.length - this.offset);
            result.set(this.bytes.subarray(this.offset, this.offset + count), done);
            this.offset += count; this.consumed += count; done += count;
        }
        return result;
    }
    async skip(length: number) {
        while (length > 0) {
            if (this.offset === this.bytes.length) {
                const next = await this.reader.read();
                if (next.done) throw new Error('incomplete');
                this.bytes = next.value; this.offset = 0;
            }
            const count = Math.min(length, this.bytes.length - this.offset);
            this.offset += count; this.consumed += count; length -= count;
        }
    }
}
const ascii = (bytes: Uint8Array, start = 0, end = bytes.length) => String.fromCharCode(...bytes.subarray(start, end));
const allocate = (channels: number, frames: number, duration: number) => {
    const bins = Math.max(1, Math.min(frames, 65536, Math.max(2048, Math.ceil(duration * 1000))));
    const peaks = Array.from({ length: Math.min(channels, 8) }, () => {
        const data = new Float32Array(bins * 2);
        for (let i = 0; i < bins; i++) { data[i * 2] = Infinity; data[i * 2 + 1] = -Infinity; }
        return data;
    });
    return { bins, peaks };
};
function addPeak(peaks: Float32Array[], channel: number, bin: number, sample: number) {
    if (!Number.isFinite(sample)) throw new Error('invalidSamples');
    const values = peaks[channel];
    values[bin * 2] = Math.min(values[bin * 2], sample);
    values[bin * 2 + 1] = Math.max(values[bin * 2 + 1], sample);
}

function wavSample(view: DataView, at: number, format: number, bits: number): number {
    let sample: number;
    if (format === 3) sample = bits === 32 ? view.getFloat32(at, true) : view.getFloat64(at, true);
    else if (bits === 8) sample = (view.getUint8(at) - 128) / 128;
    else if (bits === 16) sample = view.getInt16(at, true) / 32768;
    else if (bits === 24) { const n = view.getUint8(at) | view.getUint8(at + 1) << 8 | view.getUint8(at + 2) << 16; sample = (n & 0x800000 ? n - 0x1000000 : n) / 8388608; }
    else sample = view.getInt32(at, true) / 2147483648;
    if (!Number.isFinite(sample)) throw new Error('invalidSamples');
    return sample;
}

async function readWavHeader(reader: ByteReader) {
    const header = await reader.take(12);
    if (ascii(header, 0, 4) !== 'RIFF' || ascii(header, 8, 12) !== 'WAVE') throw new Error('unsupportedWav');
    let format = 0, channels = 0, sampleRate = 0, bits = 0, blockAlign = 0;
    let bytes = 0;
    while (!bytes) {
        const chunk = await reader.take(8);
        const id = ascii(chunk, 0, 4);
        const length = new DataView(chunk.buffer).getUint32(4, true);
        if (id === 'fmt ') {
            const value = await reader.take(Math.min(length, 64));
            if (value.length < 16) throw new Error('incomplete');
            const fmt = new DataView(value.buffer);
            format = fmt.getUint16(0, true); channels = fmt.getUint16(2, true);
            sampleRate = fmt.getUint32(4, true); blockAlign = fmt.getUint16(12, true); bits = fmt.getUint16(14, true);
            if (format === 0xfffe) {
                if (value.length < 40) throw new Error('unsupportedWav');
                const validBits = fmt.getUint16(18, true);
                format = fmt.getUint16(24, true);
                if (validBits && validBits !== bits) throw new Error('unsupportedWav');
            }
            await reader.skip(length - value.length + (length & 1));
        } else if (id === 'data') {
            bytes = length;
            if (!bytes) throw new Error('empty');
        } else await reader.skip(length + (length & 1));
    }
    if (![1, 3].includes(format) || !channels || channels > 64 || sampleRate < 1 || ![8, 16, 24, 32, 64].includes(bits) || (format === 3 && ![32, 64].includes(bits)) || (format === 1 && bits === 64) || blockAlign < channels * (bits / 8) || blockAlign > 4096) throw new Error('unsupportedWav');
    const frames = Math.floor(bytes / blockAlign);
    if (!frames) throw new Error('empty');
    const duration = frames / sampleRate;
    const metadata: AudioMetadata = { sampleRate, channels, bits, encoding: format === 3 ? 'IEEE float' : 'PCM', original: true, duration };
    return { format, channels, sampleRate, bits, blockAlign, bytes, frames, duration, metadata };
}

/** Consume WAV chunks incrementally, retaining a bounded peak envelope, not the PCM file. */
export async function readWavWaveform(stream: ReadableStream<Uint8Array>, notify: (progress: number, metadata?: AudioMetadata) => void): Promise<WaveformData> {
    const rawReader = stream.getReader();
    const reader = new ByteReader(rawReader);
    try {
        const { format, channels, sampleRate, bits, blockAlign, bytes, frames, duration, metadata } = await readWavHeader(reader);
        const { bins, peaks } = allocate(channels, frames, duration);
        notify(0, metadata);
        let frame = 0, carry = new Uint8Array(0), remaining = bytes;
        while (remaining > 0) {
            const chunk = await reader.chunk();
            if (!chunk) throw new Error('incomplete');
            const count = Math.min(remaining, chunk.length);
            remaining -= count;
            let data = chunk.subarray(0, count);
            if (carry.length) { const combined = new Uint8Array(carry.length + count); combined.set(carry); combined.set(data, carry.length); data = combined; }
            const complete = data.length - data.length % blockAlign;
            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            for (let offset = 0; offset < complete && frame < frames; offset += blockAlign, frame++) {
                const bin = Math.min(bins - 1, Math.floor(frame * bins / frames));
                for (let c = 0; c < peaks.length; c++) {
                    const at = offset + c * bits / 8;
                    const sample = wavSample(view, at, format, bits);
                    addPeak(peaks, c, bin, sample);
                }
            }
            carry = data.slice(complete);
            notify(Math.min(1, frame / frames));
        }
        if (frame !== frames) throw new Error('incomplete');
        return { metadata, bins, peaks };
    } finally { await rawReader.cancel().catch(() => {}); rawReader.releaseLock(); }
}

export function buildDecodedWaveform(channels: Float32Array[], sampleRate: number): WaveformData {
    if (!channels.length || !channels[0].length || !sampleRate) throw new Error('empty');
    const frames = channels[0].length, duration = frames / sampleRate;
    const { bins, peaks } = allocate(channels.length, frames, duration);
    channels.slice(0, 8).forEach((samples, channel) => {
        if (samples.length !== frames) throw new Error('invalidSamples');
        for (let i = 0; i < frames; i++) addPeak(peaks, channel, Math.min(bins - 1, Math.floor(i * bins / frames)), samples[i]);
    });
    return { bins, peaks, metadata: { duration, sampleRate, channels: channels.length, encoding: 'Decoded audio', original: false } };
}

export interface WavWindow { start: number; frames: number }
/** Visit sorted, possibly overlapping PCM windows without retaining the complete file. */
export async function visitWavWindows(
    stream: ReadableStream<Uint8Array>, channels: number[],
    plan: (metadata: AudioMetadata) => WavWindow[],
    visit: (samples: Float32Array[], window: WavWindow, index: number) => void,
) {
    const rawReader = stream.getReader(), reader = new ByteReader(rawReader);
    try {
        const header = await readWavHeader(reader);
        if (!channels.length || channels.length > 2 || channels.some(c => !Number.isInteger(c) || c < 0 || c >= header.channels)) throw new Error('invalidChannel');
        const windows = plan(header.metadata);
        let position = 0, cachedStart = 0, cached: Float32Array[] = [];
        for (let index = 0; index < windows.length; index++) {
            const window = windows[index], end = window.start + window.frames;
            if (!Number.isInteger(window.start) || !Number.isInteger(window.frames) || window.frames < 1 || window.frames > 1048576 || window.start < 0 || end > header.frames || (index && window.start < windows[index - 1].start)) throw new Error('invalidRange');
            if (cached.length && window.start >= cachedStart && end <= position) {
                visit(cached.map(c => c.subarray(window.start - cachedStart, end - cachedStart)), window, index); continue;
            }
            const samples = channels.map(() => new Float32Array(window.frames));
            let copied = 0;
            if (window.start < position) {
                if (window.start < cachedStart) throw new Error('invalidRange');
                copied = position - window.start;
                samples.forEach((c, i) => c.set(cached[i].subarray(window.start - cachedStart)));
            } else { await reader.skip((window.start - position) * header.blockAlign); position = window.start; }
            while (copied < window.frames) {
                const count = Math.min(window.frames - copied, Math.max(1, Math.floor(65536 / header.blockAlign)));
                const bytes = await reader.take(count * header.blockAlign);
                const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                for (let n = 0; n < count; n++) channels.forEach((c, i) => {
                    samples[i][copied + n] = wavSample(data, n * header.blockAlign + c * header.bits / 8, header.format, header.bits);
                });
                copied += count; position += count;
            }
            cached = samples; cachedStart = window.start;
            visit(samples, window, index);
        }
        return header.metadata;
    } finally { await rawReader.cancel().catch(() => {}); rawReader.releaseLock(); }
}
