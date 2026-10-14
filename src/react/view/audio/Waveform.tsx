import { useEffect, useRef, useState } from 'react';
import { $t } from '../../i18n/i18nConfig';
import { clampView, formatTime, type Selection, type TimeView, type WaveformData } from './audioModel';

interface Props {
    data: WaveformData; view: TimeView; selection: Selection; mode: string;
    media: React.RefObject<HTMLAudioElement>; onView(view: TimeView): void;
    onSelection(selection: Selection): void; onSeek(time: number): void;
}
function plot(canvas: HTMLCanvasElement, data: WaveformData, view: TimeView, selection: Selection, overview = false) {
    const width = canvas.clientWidth, height = canvas.clientHeight, ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio; canvas.height = height * ratio;
    const ctx = canvas.getContext('2d'); if (!ctx || !width) return;
    ctx.scale(ratio, ratio); ctx.clearRect(0, 0, width, height);
    const styles = getComputedStyle(canvas);
    const ink = styles.getPropertyValue('--wave-color').trim() || '#9b8cff';
    const muted = styles.getPropertyValue('--wave-muted').trim() || '#9aabb8';
    const duration = data.metadata.duration, span = overview ? duration : duration / view.zoom;
    const tracks = overview ? 1 : data.peaks.length, top = overview ? 0 : 30, trackHeight = (height - top) / tracks;
    ctx.font = '11px sans-serif'; ctx.textBaseline = 'middle';
    if (!overview) {
        const rough = span / Math.max(2, width / 100);
        const power = Math.pow(10, Math.floor(Math.log10(rough)));
        const interval = [1, 2, 5, 10].map(n => n * power).find(n => n >= rough) || power * 10;
        ctx.fillStyle = muted; ctx.strokeStyle = muted; ctx.globalAlpha = .65;
        for (let t = Math.ceil(view.start / interval) * interval; t < view.start + span; t += interval) {
            const x = (t - view.start) / span * width;
            ctx.fillText(formatTime(t), Math.max(4, Math.min(width - 78, x + 4)), 14);
            ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, height); ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    for (let channel = 0; channel < tracks; channel++) {
        const peaks = data.peaks[channel]; const center = top + trackHeight * (channel + .5);
        ctx.fillStyle = muted;
        if (!overview) ctx.fillText(data.metadata.channels === 2 ? $t(channel === 0 ? 'audio.left' : 'audio.right') : $t('audio.channel', { n: channel + 1 }), 8, top + channel * trackHeight + 12);
        ctx.strokeStyle = ink; ctx.beginPath();
        for (let x = 0; x < width; x++) {
            const first = Math.floor(((overview ? 0 : view.start) + x / width * span) / duration * data.bins);
            const last = Math.max(first + 1, Math.ceil(((overview ? 0 : view.start) + (x + 1) / width * span) / duration * data.bins));
            let min = 1, max = -1;
            for (let b = Math.max(0, first); b < Math.min(data.bins, last); b++) { min = Math.min(min, peaks[b * 2]); max = Math.max(max, peaks[b * 2 + 1]); }
            if (min > max) continue;
            const amplitude = trackHeight * (overview ? .44 : .35);
            ctx.moveTo(x + .5, center - Math.min(1, max) * amplitude); ctx.lineTo(x + .5, center - Math.max(-1, min) * amplitude);
        }
        ctx.stroke();
    }
    if (selection && !overview) {
        const x = (selection.start - view.start) / span * width, end = (selection.end - view.start) / span * width;
        ctx.fillStyle = ink; ctx.globalAlpha = .18; ctx.fillRect(x, top, end - x, height - top); ctx.globalAlpha = 1;
        ctx.strokeStyle = ink; ctx.strokeRect(x, top, end - x, height - top - 1);
    }
    if (overview) {
        ctx.fillStyle = ink; ctx.globalAlpha = .2; ctx.fillRect(view.start / duration * width, 0, width / view.zoom, height); ctx.globalAlpha = 1;
        ctx.strokeStyle = ink; ctx.strokeRect(view.start / duration * width, .5, width / view.zoom, height - 1);
    }
}
export default function Waveform({ data, view, selection, mode, media, onView, onSelection, onSeek }: Props) {
    const canvas = useRef<HTMLCanvasElement>(null), overview = useRef<HTMLCanvasElement>(null), cursor = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState(0);
    const duration = data.metadata.duration;
    const latest = useRef({ view, onView });
    useEffect(() => { latest.current = { view, onView }; }, [view, onView]);
    const gesture = useRef<{ pointer: number; x: number; start: number; time: number; pan: boolean; moved: boolean } | undefined>(undefined);
    useEffect(() => {
        const resize = new ResizeObserver(() => setSize(n => n + 1)); resize.observe(canvas.current!); return () => resize.disconnect();
    }, []);
    useEffect(() => {
        plot(canvas.current!, data, view, selection);
        plot(overview.current!, data, { zoom: view.zoom, start: view.start }, null, true);
    }, [data, view, selection, size]);
    useEffect(() => {
        // A native non-passive listener keeps wheel zoom inside the waveform.
        const element = canvas.current!;
        const wheel = (event: WheelEvent) => {
            event.preventDefault(); const current = latest.current.view;
            const fraction = Math.max(0, Math.min(1, (event.clientX - element.getBoundingClientRect().left) / element.clientWidth));
            if (event.shiftKey) latest.current.onView(clampView({ ...current, start: current.start + event.deltaY / element.clientWidth * duration / current.zoom }, duration));
            else {
                const zoom = Math.max(1, Math.min(32, current.zoom * Math.exp(-event.deltaY * .002)));
                const anchor = current.start + fraction * duration / current.zoom;
                latest.current.onView(clampView({ zoom, start: anchor - fraction * duration / zoom }, duration));
            }
        };
        element.addEventListener('wheel', wheel, { passive: false }); return () => element.removeEventListener('wheel', wheel);
    }, [duration]);
    useEffect(() => {
        let frame = 0;
        const drawCursor = () => {
            const time = media.current?.currentTime || 0, x = (time - view.start) / (duration / view.zoom) * 100;
            if (cursor.current) { cursor.current.style.left = `${x}%`; cursor.current.style.visibility = x < 0 || x > 100 ? 'hidden' : 'visible'; }
            frame = requestAnimationFrame(drawCursor);
        };
        drawCursor(); return () => cancelAnimationFrame(frame);
    }, [duration, view, media]);
    const timeAt = (event: React.PointerEvent<HTMLCanvasElement>) => Math.max(0, Math.min(duration, view.start + (event.clientX - event.currentTarget.getBoundingClientRect().left) / event.currentTarget.clientWidth * duration / view.zoom));
    return <div className="audio-wave-region">
        <div className="audio-wave-main" style={{ height: 30 + data.peaks.length * 108 }}>
            <canvas ref={canvas} aria-label={$t('audio.waveform')} data-testid="waveform" tabIndex={0}
                style={{ cursor: mode === 'pan' ? 'grab' : 'crosshair' }}
                onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); onSeek(Math.max(0, Math.min(duration, (media.current?.currentTime || 0) + (e.key === 'ArrowRight' ? 1 : -1)))); } }}
                onPointerDown={e => {
                    if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.focus();
                    gesture.current = { pointer: e.pointerId, x: e.clientX, start: view.start, time: timeAt(e), pan: mode === 'pan' || e.shiftKey, moved: false };
                }}
                onPointerMove={e => {
                    const g = gesture.current; if (!g || g.pointer !== e.pointerId) return;
                    if (Math.abs(e.clientX - g.x) > 4) g.moved = true;
                    if (!g.moved) return;
                    if (g.pan) onView(clampView({ zoom: view.zoom, start: g.start - (e.clientX - g.x) / e.currentTarget.clientWidth * duration / view.zoom }, duration));
                    else { const time = timeAt(e); onSelection({ start: Math.min(g.time, time), end: Math.max(g.time, time) }); }
                }}
                onPointerUp={e => { const g = gesture.current; if (!g || g.pointer !== e.pointerId) return; if (!g.moved) onSeek(timeAt(e)); gesture.current = undefined; e.currentTarget.releasePointerCapture(e.pointerId); }}
                onPointerCancel={() => { gesture.current = undefined; }} onLostPointerCapture={() => { gesture.current = undefined; }}/>
            <div ref={cursor} className="audio-playhead" aria-hidden="true" />
        </div>
        <canvas ref={overview} className="audio-overview" aria-label={$t('audio.overview')} data-testid="overview" onPointerDown={e => {
            const fraction = (e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.clientWidth;
            onView(clampView({ zoom: view.zoom, start: fraction * duration - duration / view.zoom / 2 }, duration));
        }}/>
        {data.metadata.channels > 8 && <p>{$t('audio.firstChannels')}</p>}
    </div>;
}
