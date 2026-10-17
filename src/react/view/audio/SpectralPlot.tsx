import { useEffect, useRef, useState } from 'react';
import { $t } from '../../i18n/i18nConfig';
import { formatTime, type Selection } from './audioModel';
import { channelLabel } from './audioLabels';
import { frequencyAt, type AnalysisResult } from './spectralModel';
const colors = ['#f5cc62', '#ff8194'];
const t = (key: string) => $t(`audio.analysis.${key}`);
function useCanvas() {
    const canvas = useRef<HTMLCanvasElement>(null), [size, setSize] = useState(0);
    useEffect(() => { const observer = new ResizeObserver(() => setSize(n => n + 1)); observer.observe(canvas.current!); return () => observer.disconnect(); }, []);
    return { canvas, size };
}
function context(canvas: HTMLCanvasElement) {
    const ratio = devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * ratio); canvas.height = Math.round(canvas.clientHeight * ratio);
    const ctx = canvas.getContext('2d')!; ctx.scale(ratio, ratio); ctx.font = '11px sans-serif'; return ctx;
}
export function SpectrumPlot({ result, modulation = false, markers }: { result: AnalysisResult; modulation?: boolean; markers: number[] }) {
    const { canvas, size } = useCanvas(), [readout, setReadout] = useState('');
    const values = modulation ? result.modulation : result.spectrum;
    const min = modulation ? 0 : result.minFrequency, max = modulation ? Math.min(120, result.metadata.sampleRate / 2) : result.maxFrequency;
    const log = !modulation && result.logarithmic, step = modulation ? result.modulationStep : result.metadata.sampleRate / result.fftSize;
    useEffect(() => {
        const el = canvas.current!, ctx = context(el), width = el.clientWidth, height = el.clientHeight, left = 48, right = width - 12, bottom = height - 28;
        const y = (db: number) => 12 + (0 - Math.max(-120, Math.min(0, db))) / 120 * (bottom - 12);
        ctx.fillStyle = '#99a8bc'; ctx.strokeStyle = '#445065';
        for (let db = 0; db >= -120; db -= 30) { ctx.fillText(String(db), 5, y(db) + 4); ctx.beginPath(); ctx.moveTo(left, y(db)); ctx.lineTo(right, y(db)); ctx.stroke(); }
        const ticks = Math.max(1, Math.min(4, Math.floor((right - left) / 120)));
        for (let i = 0; i <= ticks; i++) { const f = frequencyAt(i / ticks, min, max, log); ctx.fillText(`${f < 100 ? f.toFixed(1) : Math.round(f)} Hz`, Math.min(right - 48, left + i / ticks * (right - left)), height - 7); }
        values.forEach((channel, index) => {
            ctx.strokeStyle = colors[index]; ctx.beginPath();
            // Preserve narrow peaks when many FFT bins share one screen pixel.
            for (let x = left; x <= right; x++) {
                const low = frequencyAt((x - left) / (right - left), min, max, log) / step;
                const high = frequencyAt(Math.min(1, (x + 1 - left) / (right - left)), min, max, log) / step;
                const first = Math.min(channel.length - 1, Math.max(0, Math.ceil(low)));
                const last = Math.min(channel.length - 1, Math.max(first, Math.floor(high)));
                let peak = -140;
                for (let bin = first; bin <= last; bin++) peak = Math.max(peak, channel[bin]);
                if (x === left) ctx.moveTo(x, y(peak)); else ctx.lineTo(x, y(peak));
            }
            ctx.stroke();
        });
        if (modulation) for (const [index, marker] of markers.filter(m => m >= min && m <= max).entries()) {
            const x = left + (marker - min) / (max - min) * (right - left);
            ctx.strokeStyle = '#91d8d0'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, bottom); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = '#91d8d0'; ctx.fillText(`${marker} Hz`, Math.max(left, Math.min(right - 40, x + 3)), 23 + index % 3 * 13);
        }
    }, [canvas, result, modulation, markers, size, log, min, max, step, values]);
    return <div className="audio-spectrum-plot"><canvas ref={canvas} data-testid={modulation ? 'modulation-spectrum' : 'fft-spectrum'} role="img" aria-label={t(modulation ? 'modulation' : 'spectrum')}
        onPointerMove={event => {
            const el = event.currentTarget, fraction = Math.max(0, Math.min(1, (event.clientX - el.getBoundingClientRect().left - 48) / Math.max(1, el.clientWidth - 60)));
            const frequency = frequencyAt(fraction, min, max, log), bin = Math.round(frequency / step);
            setReadout(`${frequency.toFixed(2)} Hz · ${values.map((c, i) => `${channelLabel(result.channels[i], result.metadata.channels)}: ${(c[Math.min(bin, c.length - 1)] ?? -140).toFixed(1)} ${modulation ? t('envelopeUnit') : 'dBFS'}`).join(' · ')}`);
        }} onPointerLeave={() => setReadout('')}/><output className="audio-analysis-readout">{readout || t('hover')}</output></div>;
}

function heat(db: number): [number, number, number] {
    const level = Math.max(0, Math.min(1, (db + 100) / 100));
    const stops = [[9, 15, 32], [48, 35, 112], [173, 48, 133], [245, 123, 65], [255, 239, 151]];
    const at = level * 4, index = Math.min(3, Math.floor(at)), mix = at - index;
    return stops[index].map((v, i) => Math.round(v + (stops[index + 1][i] - v) * mix)) as [number, number, number];
}
export function Spectrogram({ result, position, selection, onSeek, onSelection }: {
    result: AnalysisResult; position: number; selection: Selection; onSeek(time: number): void; onSelection(value: Selection): void;
}) {
    const { canvas, size } = useCanvas(), [readout, setReadout] = useState('');
    const gesture = useRef<{ x: number; time: number; pointer: number; moved: boolean } | undefined>(undefined);
    const start = result.viewStart, span = result.viewEnd - start;
    const timeAt = (event: React.PointerEvent<HTMLCanvasElement>) => start + Math.max(0, Math.min(1, (event.clientX - event.currentTarget.getBoundingClientRect().left) / event.currentTarget.clientWidth)) * span;
    useEffect(() => {
        const el = canvas.current!, ctx = context(el), width = el.clientWidth, trackHeight = 155;
        result.spectrogram.forEach((values, channel) => {
            const bitmap = document.createElement('canvas'); bitmap.width = result.spectrogramFrames; bitmap.height = result.rows;
            const image = bitmap.getContext('2d')!.createImageData(bitmap.width, bitmap.height);
            for (let column = 0; column < bitmap.width; column++) for (let row = 0; row < bitmap.height; row++) {
                const at = ((bitmap.height - row - 1) * bitmap.width + column) * 4;
                const color = heat(values[column * bitmap.height + row]);
                image.data[at] = color[0]; image.data[at + 1] = color[1]; image.data[at + 2] = color[2]; image.data[at + 3] = 255;
            }
            bitmap.getContext('2d')!.putImageData(image, 0, 0); ctx.imageSmoothingEnabled = false;
            ctx.drawImage(bitmap, 0, channel * trackHeight, width, trackHeight - 1);
            ctx.fillStyle = '#111827c9'; ctx.fillRect(0, channel * trackHeight, 130, 49);
            ctx.fillStyle = colors[channel]; ctx.fillText(channelLabel(result.channels[channel], result.metadata.channels), 7, channel * trackHeight + 14);
            ctx.fillStyle = '#dbe3ef'; ctx.fillText(`${Math.round(result.maxFrequency)} Hz`, 7, channel * trackHeight + 29);
            ctx.fillText(`${result.minFrequency} Hz`, 7, (channel + 1) * trackHeight - 8);
        });
        const bottom = trackHeight * result.channels.length;
        ctx.fillStyle = '#99a8bc';
        const ticks = Math.max(1, Math.min(4, Math.floor(width / 160)));
        for (let i = 0; i <= ticks; i++) ctx.fillText(formatTime(start + i / ticks * span), Math.max(2, Math.min(width - 78, width * i / ticks)), bottom + 18);
        if (selection) {
            const left = Math.max(0, (selection.start - start) / span * width), right = Math.min(width, (selection.end - start) / span * width);
            if (right > left) { ctx.fillStyle = '#ffffff22'; ctx.fillRect(left, 0, right - left, bottom); ctx.strokeStyle = '#d8dcff'; ctx.strokeRect(left, .5, right - left, bottom - 1); }
        }
    }, [canvas, result, selection, size, start, span]);
    const cursor = (position - start) / span * 100;
    return <div className="audio-spectrogram"><div className="audio-spectrogram-image">
        <canvas ref={canvas} style={{ height: result.channels.length * 155 + 25 }} data-testid="spectrogram" tabIndex={0} role="img" aria-label={t('spectrogram')}
            onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); onSeek(position + (e.key === 'ArrowLeft' ? -1 : 1)); } }}
            onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); gesture.current = { x: e.clientX, time: timeAt(e), pointer: e.pointerId, moved: false }; }}
            onPointerMove={e => {
                const time = timeAt(e), el = e.currentTarget, height = el.clientHeight - 25;
                const y = Math.max(0, Math.min(height - 1, e.clientY - el.getBoundingClientRect().top));
                const channel = Math.min(result.channels.length - 1, Math.floor(y / 155)), fraction = 1 - (y % 155) / 155;
                const row = Math.max(0, Math.min(result.rows - 1, Math.floor(fraction * result.rows)));
                const column = Math.max(0, Math.min(result.spectrogramFrames - 1, Math.floor((time - start) / span * result.spectrogramFrames)));
                setReadout(`${formatTime(time)} · ${channelLabel(result.channels[channel], result.metadata.channels)} · ${frequencyAt(fraction, result.minFrequency, result.maxFrequency, result.logarithmic).toFixed(1)} Hz · ${result.spectrogram[channel][column * result.rows + row].toFixed(1)} dBFS`);
                const g = gesture.current;
                if (!g || g.pointer !== e.pointerId) return;
                if (Math.abs(e.clientX - g.x) > 4) g.moved = true;
                if (g.moved) onSelection({ start: Math.min(g.time, time), end: Math.max(g.time, time) });
            }}
            onPointerUp={e => { const g = gesture.current; if (!g || g.pointer !== e.pointerId) return; if (!g.moved) onSeek(timeAt(e)); gesture.current = undefined; e.currentTarget.releasePointerCapture(e.pointerId); }}
            onPointerCancel={() => { gesture.current = undefined; }} onLostPointerCapture={() => { gesture.current = undefined; }} onPointerLeave={() => setReadout('')}/>
        {cursor >= 0 && cursor <= 100 && <div className="audio-spectral-playhead" style={{ left: `${cursor}%` }} aria-hidden="true"/>}
    </div><div className="audio-heat-legend"><span>−100 dBFS</span><i/><span>0 dBFS</span></div><output className="audio-analysis-readout">{readout || t('spectrogramHint')}</output></div>;
}
