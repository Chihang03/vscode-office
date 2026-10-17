import { useEffect, useMemo, useRef, useState } from 'react';
import { $t } from '../../i18n/i18nConfig';
import { formatTime, type AudioMetadata, type AudioResource, type Selection, type TimeView } from './audioModel';
import { restoreAudioAnalysisSettings } from '../../../common/audioAnalysisSettings';
import { handler } from '../../util/vscode';
import { useAudioAnalysis } from './useAudioAnalysis';
import { SpectrumPlot, Spectrogram } from './SpectralPlot';
import { channelLabel } from './audioLabels';
const t = (key: string) => $t(`audio.analysis.${key}`);

export default function AudioAnalysis({ resource, metadata, view, selection, position, onSeek, onSelection }: {
    resource: AudioResource; metadata: AudioMetadata; view: TimeView; selection: Selection; position: number;
    onSeek(time: number): void; onSelection(value: Selection): void;
}) {
    const initial = useRef(restoreAudioAnalysisSettings(resource.analysisSettings, metadata.sampleRate, metadata.channels)).current;
    const [expanded, setExpanded] = useState(false), [channel, setChannel] = useState(initial.channel), [fftSize, setFFTSize] = useState(initial.fftSize);
    const [min, setMin] = useState(String(initial.minFrequency)), [max, setMax] = useState(String(initial.maxFrequency)), [logarithmic, setLogarithmic] = useState(initial.logarithmic);
    const [markerText, setMarkerText] = useState(initial.markers), edited = useRef(false);
    const edit = (change: () => void) => { edited.current = true; change(); };
    const markers = useMemo(() => markerText.split(/[,，\s]+/).filter(Boolean).map(Number).filter(n => Number.isFinite(n) && n > 0 && n <= 120).slice(0, 8), [markerText]);
    const wav = ['.wav', '.wave'].includes(resource.ext), viewEnd = Math.min(metadata.duration, view.start + metadata.duration / view.zoom);
    const valid = min.trim() !== '' && max.trim() !== '' && Number.isFinite(Number(min)) && Number.isFinite(Number(max)) && Number(min) >= 0 && Number(max) > Math.max(logarithmic ? 1 : 0, Number(min)) && Number(min) < metadata.sampleRate / 2;
    useEffect(() => {
        if (!edited.current || !valid) return;
        handler.emit('audioAnalysisSettings', { channel, fftSize, minFrequency: Number(min), maxFrequency: Number(max), logarithmic, markers: markerText });
    }, [channel, fftSize, min, max, logarithmic, markerText, valid]);
    const options = { start: selection?.start ?? view.start, end: selection?.end ?? viewEnd,
        viewStart: view.start, viewEnd, fftSize, channels: channel === 'both' ? [0, 1] : [Number(channel)],
        minFrequency: Number(min), maxFrequency: Number(max), logarithmic };
    const analysis = useAudioAnalysis(resource.src || '', resource.version, options, expanded && wav && valid);
    const result = analysis.result;
    return <section className="audio-analysis audio-panel" aria-label={t('title')}>
        <div className="audio-analysis-heading"><button aria-expanded={expanded} aria-controls="audio-analysis-content" onClick={() => setExpanded(value => !value)}>{expanded ? '▾' : '▸'} {t('title')}</button><span>{t('local')}</span></div>
        {expanded && <div id="audio-analysis-content">
            {!wav ? <p>{t('wavOnly')}</p> : <>
                <div className="audio-analysis-controls">
                    <label>{t('channel')}<select aria-label={t('channel')} value={channel} onChange={e => edit(() => setChannel(e.target.value))}>
                        {Array.from({ length: Math.min(8, metadata.channels) }, (_, i) => <option key={i} value={i}>{channelLabel(i, metadata.channels)}</option>)}
                        {metadata.channels >= 2 && <option value="both">{t(metadata.channels === 2 ? 'compareStereo' : 'compare')}</option>}
                    </select></label>
                    <label>{t('fftSize')}<select aria-label={t('fftSize')} value={fftSize} onChange={e => edit(() => setFFTSize(Number(e.target.value)))}>{[2048, 8192, 32768, 65536].map(n => <option key={n} value={n}>{n.toLocaleString()}</option>)}</select></label>
                    <label>{t('minFrequency')}<input aria-label={t('minFrequency')} type="number" min={0} max={metadata.sampleRate / 2} value={min} onChange={e => edit(() => setMin(e.target.value))}/></label>
                    <label>{t('maxFrequency')}<input aria-label={t('maxFrequency')} type="number" min={1} max={metadata.sampleRate / 2} value={max} onChange={e => edit(() => setMax(e.target.value))}/></label>
                    <label>{t('scale')}<select aria-label={t('scale')} value={logarithmic ? 'log' : 'linear'} onChange={e => edit(() => setLogarithmic(e.target.value === 'log'))}><option value="linear">{t('linear')}</option><option value="log">{t('log')}</option></select></label>
                    <button onClick={() => edit(() => { setMin('0'); setMax(String(metadata.sampleRate / 2)); })}>{t('fullBand')}</button>
                    <button onClick={() => edit(() => { setMin('900'); setMax('1100'); setLogarithmic(false); })} disabled={metadata.sampleRate <= 2200}>{t('carrierBand')}</button>
                </div>
                <p className="audio-analysis-note">{t('rememberSettings')}</p>
                {!valid && <p role="alert" className="audio-error">{t('invalidRange')}</p>}
                <div className="audio-analysis-status" role="status" data-testid="analysis-status">
                    <span>{analysis.status === 'loading' ? `${t('loading')} ${Math.round(analysis.progress * 100)}%` : analysis.status === 'error' ? `${t('failed')} ${['empty', 'incomplete', 'invalidSamples', 'readFailed'].includes(analysis.error || '') ? $t(`audio.${analysis.error}`) : t('unsupported')}` : t(analysis.status)}</span>
                    {analysis.status === 'loading' ? <button onClick={analysis.cancel}>{t('cancel')}</button> : <button disabled={!valid} onClick={analysis.retry}>{t('refresh')}</button>}
                </div>
                {result && <div aria-busy={analysis.status === 'loading'} className={valid ? '' : 'audio-analysis-invalid'}>
                    <div className="audio-analysis-legend">{result.channels.map((c, i) => <span key={c} style={{ color: i === 0 ? '#f5cc62' : '#ff8194' }}>● {channelLabel(c, metadata.channels)}</span>)}</div>
                    <h2>{t('spectrum')}</h2>
                    <p data-testid="analysis-range">{formatTime(result.start)} → {formatTime(result.end)} · {t('average')} {result.spectrumFrames} · {t('hannWindow')} · {result.windowFrames} {t('samples')} ({(result.windowFrames / metadata.sampleRate * 1000).toFixed(1)} ms) · {t('binSpacing')} {(metadata.sampleRate / result.fftSize).toFixed(2)} Hz · dBFS</p>
                    <SpectrumPlot result={result} markers={markers}/>
                    <p className="audio-analysis-note">{t('spectrumNote')}</p>
                    <h2>{t('spectrogram')}</h2>
                    <p>{t('viewRange')} {formatTime(result.viewStart)} → {formatTime(result.viewEnd)} · {result.spectrogramFrames} {t('timeWindows')} · {result.minFrequency}–{result.maxFrequency} Hz</p>
                    <p className="audio-analysis-note">{t('spectrogramNote')}</p>
                    <Spectrogram result={result} position={position} selection={selection} onSeek={onSeek} onSelection={onSelection}/>
                    <h2>{t('modulation')}</h2>
                    <label className="audio-marker-control">{t('markers')}<input aria-label={t('markers')} value={markerText} maxLength={128} onChange={e => edit(() => setMarkerText(e.target.value))} placeholder="37, 47"/></label>
                    <p data-testid="modulation-range">{formatTime(result.modulationStart)} → {formatTime(result.modulationEnd)} · {t('envelopeBand')} {result.minFrequency}–{result.maxFrequency} Hz · {t('binSpacing')} {result.modulationStep.toFixed(2)} Hz</p>
                    <SpectrumPlot result={result} modulation markers={markers}/>
                    <p className="audio-analysis-note">{t('modulationNote')}</p>
                    <p className="audio-analysis-note">{t('evidence')}</p>
                </div>}
            </>}
        </div>}
    </section>;
}
