import { useEffect, useMemo, useRef, useState } from 'react';
import { Spin } from 'antd';
import { $t } from '../../../i18n/i18nConfig';
import { handler } from '../../../util/vscode';
import type { GitCommit } from '../types';
import type { GraphConfig } from '../graph/layoutEngine';
import DialogOverlay from './DialogOverlay';
import {
    filterCommitsForDevLog,
    formatDateYmd,
    renderDevLogHtml,
    renderDevLogMarkdown,
    type DevLogCommitStat,
    type DevLogOptions,
    type DevLogRangePreset,
    type DevLogTemplate,
} from '../util/devLogRenderer';

export type DevLogExportFormat = 'png' | 'pdf' | 'markdown';

interface DevLogExportDialogProps {
    open: boolean;
    initialTemplate: DevLogTemplate;
    initialUseSelection?: boolean;
    repo: string;
    repoName: string;
    branchLabel: string;
    commitHead: string | null;
    commits: ReadonlyArray<GitCommit>;
    selectedCommits: ReadonlyArray<GitCommit>;
    graphConfig: GraphConfig;
    onClose: () => void;
}

let nextRequestId = 1;

function getDefaultDateRange(): { from: string; to: string } {
    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 7 * 24 * 60 * 60;
    return {
        from: formatDateYmd(weekAgo),
        to: formatDateYmd(now),
    };
}

function sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'repo';
}

export default function DevLogExportDialog({
    open,
    initialTemplate,
    initialUseSelection = false,
    repo,
    repoName,
    branchLabel,
    commitHead,
    commits,
    selectedCommits,
    graphConfig,
    onClose,
}: DevLogExportDialogProps) {
    const defaults = useMemo(() => getDefaultDateRange(), []);
    const [options, setOptions] = useState<DevLogOptions>(() => ({
        template: initialTemplate,
        rangePreset: initialUseSelection && selectedCommits.length > 0 ? 'selected' : 'current',
        dateFrom: defaults.from,
        dateTo: defaults.to,
        includeStats: true,
        excludeMerges: false,
        includeBody: initialTemplate === 'report',
        includeFiles: initialTemplate !== 'graph',
        groupByType: initialTemplate === 'report',
        theme: 'light',
    }));

    const [statsMap, setStatsMap] = useState<Record<string, DevLogCommitStat>>({});
    const [loadingStats, setLoadingStats] = useState(false);
    const [exportingFormat, setExportingFormat] = useState<DevLogExportFormat | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);

    const statsRequestIdRef = useRef<number>(0);
    const exportRequestIdRef = useRef<number>(0);
    const fetchedHashesRef = useRef<Set<string>>(new Set());
    const inFlightHashesRef = useRef<Set<string>>(new Set());
    const lastRepoRef = useRef<string>(repo);

    // Sync template & range when dialog opens
    useEffect(() => {
        if (!open) return;
        setExportError(null);
        setOptions((prev) => ({
            ...prev,
            template: initialTemplate,
            rangePreset: initialUseSelection && selectedCommits.length > 0 ? 'selected' : prev.rangePreset === 'selected' && selectedCommits.length === 0 ? 'current' : prev.rangePreset,
            includeBody: initialTemplate === 'report' ? true : prev.includeBody,
            groupByType: initialTemplate === 'report' ? true : prev.groupByType,
        }));
    }, [open, initialTemplate, initialUseSelection, selectedCommits.length]);

    // Reset cached stats if repo changes
    useEffect(() => {
        if (lastRepoRef.current !== repo) {
            lastRepoRef.current = repo;
            fetchedHashesRef.current = new Set();
            inFlightHashesRef.current = new Set();
            setStatsMap({});
        }
    }, [repo]);

    // Escape to close
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !exportingFormat) {
                e.preventDefault();
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, exportingFormat, onClose]);

    // Subscribe to backend stats & export responses
    useEffect(() => {
        if (!open) return;
        const onStatsResult = (payload: { requestId: number; stats: Record<string, DevLogCommitStat>; error: string | null }) => {
            if (payload.stats) {
                for (const hash of Object.keys(payload.stats)) {
                    fetchedHashesRef.current.add(hash);
                    inFlightHashesRef.current.delete(hash);
                }
                setStatsMap((prev) => ({ ...prev, ...payload.stats }));
            }
            if (payload.requestId === statsRequestIdRef.current) {
                inFlightHashesRef.current.clear();
                setLoadingStats(false);
            }
        };
        const onExportResult = (payload: { requestId: number; savedPath: string | null; error: string | null; cancelled?: boolean }) => {
            if (payload.requestId !== exportRequestIdRef.current) return;
            setExportingFormat(null);
            if (payload.error) {
                setExportError(payload.error);
            } else {
                setExportError(null);
            }
        };

        handler.on('devLogStatsResult', onStatsResult);
        handler.on('exportDevLogResult', onExportResult);
        return () => {
            handler.off('devLogStatsResult', onStatsResult);
            handler.off('exportDevLogResult', onExportResult);
            inFlightHashesRef.current.clear();
            setLoadingStats(false);
        };
    }, [open]);

    const filteredCommits = useMemo(
        () => filterCommitsForDevLog(commits, selectedCommits, options),
        [commits, selectedCommits, options],
    );

    // Fetch missing commit stats when needed
    const needsStats = options.includeStats || options.includeFiles || options.includeBody;
    useEffect(() => {
        if (!open || !repo || !needsStats) return;
        const missing = filteredCommits
            .map((c) => c.hash)
            .filter((h) => h && h !== '*' && !fetchedHashesRef.current.has(h) && !inFlightHashesRef.current.has(h));
        if (missing.length === 0) return;

        for (const h of missing) {
            inFlightHashesRef.current.add(h);
        }
        const reqId = nextRequestId++;
        statsRequestIdRef.current = reqId;
        setLoadingStats(true);
        handler.emit('loadDevLogStats', {
            repo,
            hashes: missing,
            requestId: reqId,
        });
    }, [open, repo, needsStats, filteredCommits]);

    const generatedAt = useMemo(() => formatDateYmd(Math.floor(Date.now() / 1000)), [open]);

    const renderContext = useMemo(() => ({
        repoName,
        branchLabel,
        commitHead,
        commits: filteredCommits,
        stats: statsMap,
        options,
        graphConfig,
        generatedAt,
    }), [repoName, branchLabel, commitHead, filteredCommits, statsMap, options, graphConfig, generatedAt]);

    const previewHtml = useMemo(() => {
        if (!open) return '';
        return renderDevLogHtml(renderContext);
    }, [open, renderContext]);

    if (!open) return null;

    const handleExport = (format: DevLogExportFormat) => {
        if (exportingFormat || filteredCommits.length === 0) return;
        setExportError(null);
        setExportingFormat(format);

        const reqId = nextRequestId++;
        exportRequestIdRef.current = reqId;

        const ext = format === 'markdown' ? 'md' : format;
        const baseName = `${sanitizeFileName(repoName)}-devlog-${options.template}-${generatedAt}.${ext}`;
        const content = format === 'markdown'
            ? renderDevLogMarkdown(renderContext)
            : previewHtml;

        handler.emit('exportDevLog', {
            requestId: reqId,
            repo,
            format,
            suggestedFileName: baseName,
            content,
            viewportWidth: options.template === 'graph' ? 1060 : 940,
            headerTitle: `${repoName} · ${$t(
                options.template === 'report'
                    ? 'git.devLog.templateReport'
                    : options.template === 'graph'
                        ? 'git.devLog.templateGraph'
                        : 'git.devLog.templateTimeline'
            )}`,
            footerDate: $t('git.devLog.generatedAt', { date: generatedAt }),
        });
    };

    const templateOptions: { id: DevLogTemplate; icon: string; titleKey: string; descKey: string }[] = [
        { id: 'timeline', icon: 'list-unordered', titleKey: 'git.devLog.templateTimeline', descKey: 'git.devLog.templateTimelineDesc' },
        { id: 'report', icon: 'file-pdf', titleKey: 'git.devLog.templateReport', descKey: 'git.devLog.templateReportDesc' },
        { id: 'graph', icon: 'git-merge', titleKey: 'git.devLog.templateGraph', descKey: 'git.devLog.templateGraphDesc' },
    ];

    const rangeOptions: { id: DevLogRangePreset; label: string; disabled?: boolean }[] = [
        { id: 'current', label: $t('git.devLog.rangeCurrent') },
        ...(selectedCommits.length > 0 ? [{ id: 'selected' as const, label: $t('git.devLog.rangeSelected', { count: selectedCommits.length }) }] : []),
        { id: '7d', label: $t('git.devLog.rangeLast7Days') },
        { id: '30d', label: $t('git.devLog.rangeLast30Days') },
        { id: 'custom', label: $t('git.devLog.rangeCustom') },
    ];

    return (
        <DialogOverlay onCancel={exportingFormat ? () => undefined : onClose}>
            <div
                className="git-graph-devlog-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={$t('git.devLog.dialogTitle')}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="git-graph-dialog-header">
                    <h2>{$t('git.devLog.dialogTitle')}</h2>
                    <button
                        type="button"
                        className="git-graph-icon-btn"
                        title={$t('common.close')}
                        onClick={onClose}
                        disabled={Boolean(exportingFormat)}
                    >
                        <span className="codicon codicon-close" aria-hidden />
                    </button>
                </div>

                <div className="git-graph-devlog-body">
                    <aside className="git-graph-devlog-sidebar">
                        <div className="git-graph-devlog-section">
                            <div className="git-graph-devlog-section-title">{$t('git.devLog.templateLabel')}</div>
                            <div className="git-graph-devlog-templates">
                                {templateOptions.map((tpl) => (
                                    <button
                                        key={tpl.id}
                                        type="button"
                                        className={`git-graph-devlog-tpl-btn${options.template === tpl.id ? ' active' : ''}`}
                                        onClick={() => setOptions((prev) => ({ ...prev, template: tpl.id }))}
                                    >
                                        <span className={`codicon codicon-${tpl.icon}`} aria-hidden />
                                        <span className="git-graph-devlog-tpl-text">
                                            <strong>{$t(tpl.titleKey)}</strong>
                                            <small>{$t(tpl.descKey)}</small>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="git-graph-devlog-section">
                            <div className="git-graph-devlog-section-title">{$t('git.devLog.rangeLabel')}</div>
                            <div className="git-graph-devlog-pills">
                                {rangeOptions.map((r) => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        className={`git-graph-devlog-pill${options.rangePreset === r.id ? ' active' : ''}`}
                                        onClick={() => setOptions((prev) => ({ ...prev, rangePreset: r.id }))}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                            {options.rangePreset === 'custom' && (
                                <div className="git-graph-devlog-dates">
                                    <label>
                                        <span>{$t('git.devLog.dateFrom')}</span>
                                        <input
                                            type="date"
                                            className="vscode-input"
                                            value={options.dateFrom}
                                            onChange={(e) => setOptions((prev) => ({ ...prev, dateFrom: e.target.value }))}
                                        />
                                    </label>
                                    <label>
                                        <span>{$t('git.devLog.dateTo')}</span>
                                        <input
                                            type="date"
                                            className="vscode-input"
                                            value={options.dateTo}
                                            onChange={(e) => setOptions((prev) => ({ ...prev, dateTo: e.target.value }))}
                                        />
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="git-graph-devlog-section">
                            <div className="git-graph-devlog-section-title">{$t('git.devLog.optionsLabel')}</div>
                            <label className="git-graph-settings-checkbox">
                                <input
                                    type="checkbox"
                                    checked={options.includeStats}
                                    onChange={(e) => setOptions((prev) => ({ ...prev, includeStats: e.target.checked }))}
                                />
                                <span>{$t('git.devLog.includeStats')}</span>
                            </label>
                            <label className="git-graph-settings-checkbox">
                                <input
                                    type="checkbox"
                                    checked={options.excludeMerges}
                                    onChange={(e) => setOptions((prev) => ({ ...prev, excludeMerges: e.target.checked }))}
                                />
                                <span>{$t('git.devLog.excludeMerges')}</span>
                            </label>
                            <label className="git-graph-settings-checkbox">
                                <input
                                    type="checkbox"
                                    checked={options.includeFiles}
                                    onChange={(e) => setOptions((prev) => ({ ...prev, includeFiles: e.target.checked }))}
                                />
                                <span>{$t('git.devLog.includeFiles')}</span>
                            </label>
                            {options.template !== 'graph' && (
                                <label className="git-graph-settings-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={options.includeBody}
                                        onChange={(e) => setOptions((prev) => ({ ...prev, includeBody: e.target.checked }))}
                                    />
                                    <span>{$t('git.devLog.includeBody')}</span>
                                </label>
                            )}
                            {options.template === 'report' && (
                                <label className="git-graph-settings-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={options.groupByType}
                                        onChange={(e) => setOptions((prev) => ({ ...prev, groupByType: e.target.checked }))}
                                    />
                                    <span>{$t('git.devLog.groupByType')}</span>
                                </label>
                            )}
                        </div>

                        <div className="git-graph-devlog-section">
                            <div className="git-graph-devlog-section-title">{$t('git.devLog.themeLabel')}</div>
                            <div className="git-graph-devlog-pills">
                                <button
                                    type="button"
                                    className={`git-graph-devlog-pill${options.theme === 'light' ? ' active' : ''}`}
                                    onClick={() => setOptions((prev) => ({ ...prev, theme: 'light' }))}
                                >
                                    {$t('git.devLog.themeLight')}
                                </button>
                                <button
                                    type="button"
                                    className={`git-graph-devlog-pill${options.theme === 'dark' ? ' active' : ''}`}
                                    onClick={() => setOptions((prev) => ({ ...prev, theme: 'dark' }))}
                                >
                                    {$t('git.devLog.themeDark')}
                                </button>
                            </div>
                        </div>
                    </aside>

                    <div className="git-graph-devlog-preview-pane">
                        <div className="git-graph-devlog-preview-bar">
                            <span>{$t('git.devLog.previewLabel', { count: filteredCommits.length })}</span>
                            {loadingStats && (
                                <span className="git-graph-devlog-loading-tag">
                                    <Spin size="small" />
                                    <span>{$t('git.devLog.loadingStats')}</span>
                                </span>
                            )}
                        </div>
                        <iframe
                            className="git-graph-devlog-iframe"
                            title={$t('git.devLog.dialogTitle')}
                            srcDoc={previewHtml}
                            sandbox="allow-same-origin"
                        />
                    </div>
                </div>

                {exportError && (
                    <div className="git-graph-devlog-error" role="alert">
                        <span className="codicon codicon-error" aria-hidden />
                        <span>{exportError}</span>
                    </div>
                )}

                <div className="git-graph-dialog-footer git-graph-devlog-footer">
                    <button
                        type="button"
                        className="git-graph-dialog-btn"
                        onClick={onClose}
                        disabled={Boolean(exportingFormat)}
                    >
                        {$t('common.cancel')}
                    </button>
                    <div className="git-graph-devlog-export-actions">
                        <button
                            type="button"
                            className="git-graph-dialog-btn"
                            disabled={filteredCommits.length === 0 || Boolean(exportingFormat)}
                            onClick={() => handleExport('markdown')}
                        >
                            {exportingFormat === 'markdown' ? <Spin size="small" /> : <span className="codicon codicon-markdown" aria-hidden />}
                            <span>{exportingFormat === 'markdown' ? $t('git.devLog.exporting') : $t('git.devLog.exportMarkdown')}</span>
                        </button>
                        <button
                            type="button"
                            className="git-graph-dialog-btn primary"
                            disabled={filteredCommits.length === 0 || Boolean(exportingFormat)}
                            onClick={() => handleExport('png')}
                        >
                            {exportingFormat === 'png' ? <Spin size="small" /> : <span className="codicon codicon-file-media" aria-hidden />}
                            <span>{exportingFormat === 'png' ? $t('git.devLog.exporting') : $t('git.devLog.exportPng')}</span>
                        </button>
                        <button
                            type="button"
                            className="git-graph-dialog-btn primary"
                            disabled={filteredCommits.length === 0 || Boolean(exportingFormat)}
                            onClick={() => handleExport('pdf')}
                        >
                            {exportingFormat === 'pdf' ? <Spin size="small" /> : <span className="codicon codicon-file-pdf" aria-hidden />}
                            <span>{exportingFormat === 'pdf' ? $t('git.devLog.exporting') : $t('git.devLog.exportPdf')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </DialogOverlay>
    );
}
