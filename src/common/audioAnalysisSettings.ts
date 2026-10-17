/** Small user preferences only; PCM and analysis results are never persisted here. */
export interface AudioAnalysisSettings {
    channel: string;
    fftSize: number;
    minFrequency: number;
    maxFrequency: number;
    logarithmic: boolean;
    markers: string;
}
export function parseAudioAnalysisSettings(value: unknown): AudioAnalysisSettings | undefined {
    if (!value || typeof value !== 'object') return;
    const input = value as AudioAnalysisSettings;
    if (!['0', '1', '2', '3', '4', '5', '6', '7', 'both'].includes(input.channel)
        || ![2048, 8192, 32768, 65536].includes(input.fftSize)
        || !Number.isFinite(input.minFrequency) || !Number.isFinite(input.maxFrequency)
        || input.minFrequency < 0 || input.maxFrequency <= input.minFrequency || input.maxFrequency > 2147483648
        || typeof input.logarithmic !== 'boolean' || (input.logarithmic && input.maxFrequency <= 1)
        || typeof input.markers !== 'string' || input.markers.length > 128) return;
    return { channel: input.channel, fftSize: input.fftSize, minFrequency: input.minFrequency,
        maxFrequency: input.maxFrequency, logarithmic: input.logarithmic, markers: input.markers };
}
export function restoreAudioAnalysisSettings(saved: unknown, sampleRate: number, channels: number): AudioAnalysisSettings {
    const settings = parseAudioAnalysisSettings(saved), max = Math.min(settings?.maxFrequency ?? sampleRate / 2, sampleRate / 2);
    const channel = settings?.channel ?? '0';
    return {
        channel: channel === 'both' ? (channels >= 2 ? 'both' : '0') : Number(channel) < channels ? channel : '0',
        fftSize: settings?.fftSize ?? 32768,
        minFrequency: (settings?.minFrequency ?? 0) < max ? settings?.minFrequency ?? 0 : 0,
        maxFrequency: max,
        logarithmic: (settings?.logarithmic ?? false) && max > 1,
        markers: settings?.markers ?? '37, 47',
    };
}
