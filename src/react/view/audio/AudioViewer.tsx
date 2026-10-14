import { useEffect, useRef, useState } from 'react';
import { $t } from '../../i18n/i18nConfig';
import { handler } from '../../util/vscode';
import { clampView, formatTime, type AudioResource, type Selection, type TimeView } from './audioModel';
import { useWaveform } from './useWaveform';
import Waveform from './Waveform';
import './AudioViewer.less';

const t = (key: string) => $t(`audio.${key}`);
function AudioDocument({ resource }: { resource: AudioResource }) {
    const url = resource.src || '';
    const media = useRef<HTMLAudioElement>(null);
    const [duration, setDuration] = useState(0), [position, setPosition] = useState(0), [playing, setPlaying] = useState(false);
    const [playError, setPlayError] = useState(''), [volume, setVolume] = useState(1), [muted, setMuted] = useState(false), [speed, setSpeed] = useState(1);
    const [view, setView] = useState<TimeView>({ zoom: 1, start: 0 }), [selection, setSelection] = useState<Selection>(null), [loop, setLoop] = useState(false), [mode, setMode] = useState('select');
    const activeLoop = useRef({ loop, selection });
    useEffect(() => { activeLoop.current = { loop, selection }; }, [loop, selection]);
    const waveform = useWaveform(resource, url, duration, !!playError);
    const trackDuration = waveform.metadata?.duration || duration;
    useEffect(() => () => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); }, [url]);
    useEffect(() => {
        const audio = media.current!; let frame = 0, last = 0, savedAt = 0;
        const persist = () => handler.emit('audioPosition', { time: audio.currentTime });
        const tick = () => {
            const { loop: enabled, selection: range } = activeLoop.current;
            if (enabled && range && !audio.paused && (audio.currentTime >= range.end || audio.currentTime < range.start)) audio.currentTime = range.start;
            if (performance.now() - last > 80) { setPosition(audio.currentTime); last = performance.now(); }
            if (!audio.paused && Date.now() - savedAt > 2000) { persist(); savedAt = Date.now(); }
            frame = requestAnimationFrame(tick);
        };
        tick();
        audio.addEventListener('pause', persist); window.addEventListener('pagehide', persist); document.addEventListener('visibilitychange', persist);
        return () => { persist(); audio.pause(); cancelAnimationFrame(frame); audio.removeEventListener('pause', persist); window.removeEventListener('pagehide', persist); document.removeEventListener('visibilitychange', persist); };
    }, []);
    const seek = (time: number) => { const audio = media.current; if (!audio || !Number.isFinite(audio.duration)) return; audio.currentTime = Math.max(0, Math.min(audio.duration, time)); setPosition(audio.currentTime); handler.emit('audioPosition', { time: audio.currentTime }); };
    const restored = useRef(false);
    const updateMediaInfo = (event: React.SyntheticEvent<HTMLAudioElement>) => {
        const audio = event.currentTarget;
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
        setDuration(audio.duration);
        if (!restored.current) {
            restored.current = true;
            const saved = resource.resumeTime || 0;
            if (saved > 0 && saved < audio.duration - .5) { audio.currentTime = saved; setPosition(saved); }
        }
    };
    const toggle = async () => {
        const audio = media.current!;
        if (!audio.paused) { audio.pause(); return; }
        if (loop && selection && (audio.currentTime < selection.start || audio.currentTime >= selection.end)) seek(selection.start);
        try { await audio.play(); setPlayError(''); } catch { setPlayError(t('playFailed')); }
    };
    const zoom = (factor: number) => setView(current => clampView({ zoom: current.zoom * factor, start: current.start + trackDuration / current.zoom / 2 - trackDuration / Math.max(1, Math.min(32, current.zoom * factor)) / 2 }, trackDuration));
    return <main className="studio-audio">
        <header><div><span className="audio-eyebrow">KIERAN DOCUMENT STUDIO</span><h1>{resource.fileName}</h1></div><span className="audio-format">{resource.ext.slice(1).toUpperCase()}</span></header>
        <audio ref={media} src={url || undefined} preload="metadata" onLoadedMetadata={updateMediaInfo} onDurationChange={updateMediaInfo} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setPlayError(t('playFailed'))}
            onTimeUpdate={e => { const state = activeLoop.current; if (state.loop && state.selection && !e.currentTarget.paused && (e.currentTarget.currentTime >= state.selection.end || e.currentTarget.currentTime < state.selection.start)) e.currentTarget.currentTime = state.selection.start; setPosition(e.currentTarget.currentTime); }}
            onEnded={() => { if (activeLoop.current.loop && activeLoop.current.selection) { seek(activeLoop.current.selection.start); void media.current!.play().catch(() => setPlayError(t('playFailed'))); } }}/>
        <section className="audio-meta" aria-label={t('information')}>
            <div><span>{t('duration')}</span><strong>{formatTime(trackDuration)}</strong></div>
            <div><span>{t('size')}</span><strong>{resource.size == null ? '—' : `${(resource.size / 1024 / 1024).toFixed(2)} MB`}</strong></div>
            <div><span>{t(waveform.metadata?.original ? 'sourceRate' : 'decodedRate')}</span><strong>{waveform.metadata ? `${waveform.metadata.sampleRate.toLocaleString()} Hz` : '—'}</strong></div>
            <div><span>{t('channels')}</span><strong>{waveform.metadata?.channels || '—'}</strong></div>
            <div><span>{t('encoding')}</span><strong>{waveform.metadata ? `${waveform.metadata.encoding}${waveform.metadata.bits ? ` · ${waveform.metadata.bits} bit` : ''}` : '—'}</strong></div>
        </section>
        <section className="audio-panel">
            <div className="audio-toolbar"><div className="audio-mode"><button aria-pressed={mode === 'select'} onClick={() => setMode('select')}>{t('select')}</button><button aria-pressed={mode === 'pan'} onClick={() => setMode('pan')}>{t('pan')}</button></div>
                <div className="audio-zoom"><button aria-label={t('zoomOut')} onClick={() => zoom(.5)} disabled={!waveform.data || view.zoom <= 1}>−</button><span>{view.zoom.toFixed(1)}×</span><button aria-label={t('zoomIn')} onClick={() => zoom(2)} disabled={!waveform.data || view.zoom >= 32}>+</button><button onClick={() => setView({ zoom: 1, start: 0 })}>{t('fullTrack')}</button></div>
            </div>
            {waveform.data ? <Waveform data={waveform.data} view={view} selection={selection} mode={mode} media={media} onView={setView} onSelection={range => { setSelection(range); if (!range || range.end - range.start < .05) setLoop(false); }} onSeek={seek}/> :
                <div className="audio-wave-placeholder" role="status" data-testid="wave-status"><span>{waveform.status === 'loading' ? `${t('generating')} ${Math.round(waveform.progress * 100)}%` : waveform.status === 'cancelled' ? t('cancelled') : t(waveform.error)}</span>
                    {waveform.status === 'loading' && <button onClick={waveform.cancel}>{t('cancel')}</button>}</div>}
            <div className="audio-wave-caption"><span>{t('waveHint')}</span><span data-testid="cache-status">{waveform.data ? t(waveform.status) : t('local')}</span></div>
        </section>
        <section className="audio-transport">
            <button className="audio-play" aria-label={playing ? t('pause') : t('play')} onClick={toggle} disabled={!duration || !!playError}>{playing ? 'Ⅱ' : '▶'}</button>
            <output data-testid="position">{formatTime(position)} / {formatTime(trackDuration)}</output>
            <label className="audio-seek"><span className="audio-sr-only">{t('seek')}</span><input aria-label={t('seek')} type="range" min={0} max={duration || 1} step={.01} value={Math.min(position, duration || 0)} onChange={e => seek(Number(e.target.value))}/></label>
            <label>{t('speed')} <select aria-label={t('speed')} value={speed} onChange={e => { const value = Number(e.target.value); setSpeed(value); media.current!.playbackRate = value; }}>{[.5, .75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
            <button aria-pressed={muted} onClick={() => { setMuted(!muted); media.current!.muted = !muted; }}>{t(muted ? 'unmute' : 'mute')}</button>
            <input className="audio-volume" aria-label={t('volume')} type="range" min={0} max={1} step={.01} value={volume} onChange={e => { const value = Number(e.target.value); setVolume(value); media.current!.volume = value; }}/>
        </section>
        <section className="audio-selection"><div><span className="audio-eyebrow">{t('selection')}</span><p data-testid="selection">{selection ? `${formatTime(selection.start)} → ${formatTime(selection.end)} · ${formatTime(selection.end - selection.start)}` : t('noSelection')}</p></div>
            <label><input type="checkbox" aria-label={t('loop')} checked={loop} disabled={!selection || selection.end - selection.start < .05} onChange={e => { setLoop(e.target.checked); if (e.target.checked && selection) seek(selection.start); }}/>{t('loop')}</label>
            <button disabled={!selection} onClick={() => { setSelection(null); setLoop(false); }}>{t('clearSelection')}</button>
        </section>
        {playError && <p className="audio-error" role="alert">{playError}</p>}
        <footer>{t('readOnly')}</footer>
    </main>;
}
export default function AudioViewer() {
    const [resource, setResource] = useState<AudioResource>();
    useEffect(() => {
        const receive = (event: MessageEvent) => { if (event.data?.type === 'audio') {
            const next: AudioResource = event.data.content;
            if (next.buffer) { const src = URL.createObjectURL(new Blob([new Uint8Array(next.buffer)], { type: next.mime })); setResource({ ...next, src, buffer: undefined }); }
            else setResource(next);
        } };
        window.addEventListener('message', receive); handler.emit('audioInit'); return () => window.removeEventListener('message', receive);
    }, []);
    if (!resource) return <div className="studio-audio" role="status">{t('loading')}</div>;
    if (resource.error) return <div className="studio-audio audio-error" role="alert">{resource.fileName}: {resource.error}</div>;
    return <AudioDocument key={resource.version} resource={resource}/>;
}
