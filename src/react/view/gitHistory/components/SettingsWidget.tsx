import { useEffect, useRef, useState } from 'react';
import { $t } from '../../../i18n/i18nConfig';
import { renderI18nTemplate } from '../util/i18nTemplate';
import type { GitPullDefaults, FileHistorySplitLayout } from '../util/gitHistoryState';
import type { GitRemoteDetail } from '../types';
import { getConfigs } from '../../../util/vscodeConfig';
import { handler } from '../../../util/vscode';

interface SettingsWidgetProps {
    open: boolean;
    repo: string;
    remotes: GitRemoteDetail[];
    loading: boolean;
    pullDefaults: GitPullDefaults;
    fileHistorySplitLayout: FileHistorySplitLayout;
    onClose: () => void;
    onPullDefaultsChange: (defaults: GitPullDefaults) => void;
    onFileHistorySplitLayoutChange: (layout: FileHistorySplitLayout) => void;
    onAddRemote: () => void;
    onEditRemote: (name: string) => void;
    onDeleteRemote: (name: string) => void;
    fetching: boolean;
    pulling: boolean;
    pushing: boolean;
}

async function copyText(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copied) {
        throw new Error('Copy failed');
    }
}

export default function SettingsWidget({
    open, repo, remotes, loading, pullDefaults, fileHistorySplitLayout, onClose,
    onPullDefaultsChange, onFileHistorySplitLayoutChange, onAddRemote, onEditRemote, onDeleteRemote,
    fetching, pulling, pushing,
}: SettingsWidgetProps) {
    const [copiedRemoteName, setCopiedRemoteName] = useState<string | null>(null);
    const [showQuickSyncButton, setShowQuickSyncButton] = useState<boolean>(() => {
        const initial = Boolean(getConfigs()?.gitHistorySettings?.quickSyncButton);
        return initial;
    });
    const copyResetTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    useEffect(() => () => {
        if (copyResetTimerRef.current !== null) {
            window.clearTimeout(copyResetTimerRef.current);
        }
    }, []);

    if (!open) return null;

    const repoLabel = repo.split(/[/\\]/).pop() ?? repo;
    const handleCopyRemote = async (remote: GitRemoteDetail) => {
        if (!remote.url) return;
        try {
            await copyText(remote.url);
            setCopiedRemoteName(remote.name);
            if (copyResetTimerRef.current !== null) {
                window.clearTimeout(copyResetTimerRef.current);
            }
            copyResetTimerRef.current = window.setTimeout(() => {
                setCopiedRemoteName((current) => (current === remote.name ? null : current));
                copyResetTimerRef.current = null;
            }, 1600);
        } catch {
            setCopiedRemoteName(null);
        }
    };

    return (
        <aside className="git-graph-settings-panel" aria-label={$t('git.settings')}>
            <div className="git-graph-settings-body">
                <section className="git-graph-settings-group">
                    <div className="git-graph-settings-group-header">
                        <h2>{$t('git.repoSettings')}</h2>
                        <button type="button" className="git-graph-icon-btn" title={$t('common.close')} onClick={onClose}>
                            <span className="codicon codicon-close" aria-hidden />
                        </button>
                    </div>
                    <div className="git-graph-settings-group-content">
                        <div className="git-graph-settings-section">
                            <h3>{$t('git.remoteConfig')}</h3>
                            {loading ? (
                                <p className="git-graph-muted">{$t('git.loadingRemotes')}</p>
                            ) : remotes.length === 0 ? (
                                <p className="git-graph-muted">{$t('git.noRemotesConfigured')}</p>
                            ) : (
                                <table className="git-graph-settings-table">
                                    <thead>
                                        <tr>
                                            <th>{$t('git.remoteCol')}</th>
                                            <th>{$t('git.urlCol')}</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {remotes.map((remote) => (
                                            <tr key={remote.name}>
                                                <td>{remote.name}</td>
                                                <td className="git-graph-settings-url" title={remote.url ?? ''}>
                                                    {remote.url ?? $t('git.notSet')}
                                                </td>
                                                <td className="git-graph-settings-actions">
                                                    <button
                                                        type="button"
                                                        className="git-graph-icon-btn git-graph-settings-action-copy"
                                                        title={copiedRemoteName === remote.name ? $t('common.copied') : $t('git.copyRemoteUrl')}
                                                        onClick={() => void handleCopyRemote(remote)}
                                                        disabled={!remote.url}
                                                    >
                                                        <span
                                                            className={`codicon ${copiedRemoteName === remote.name ? 'codicon-check' : 'codicon-copy'}`}
                                                            aria-hidden
                                                        />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="git-graph-icon-btn git-graph-settings-action-edit"
                                                        title={$t('git.editRemote')}
                                                        onClick={() => onEditRemote(remote.name)}
                                                    >
                                                        <span className="codicon codicon-edit" aria-hidden />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="git-graph-icon-btn git-graph-settings-action-delete"
                                                        title={$t('git.deleteRemoteBtn')}
                                                        onClick={() => onDeleteRemote(remote.name)}
                                                    >
                                                        <span className="codicon codicon-trash" aria-hidden />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            <div className="git-graph-settings-section-actions">
                                <button type="button" className="git-graph-settings-btn" onClick={onAddRemote}>
                                    <span className="codicon codicon-add" aria-hidden />
                                    {$t('git.addRemote')}
                                </button>
                            </div>
                        </div>

                        <div className="git-graph-settings-section">
                            <h3>{$t('git.defaultPullBehaviour')}</h3>
                            <p className="git-graph-settings-hint">
                                {renderI18nTemplate('git.defaultPullHint', {
                                    repo: <strong>{repoLabel}</strong>,
                                })}
                            </p>
                            <label className="git-graph-settings-checkbox">
                                <input
                                    type="checkbox"
                                    checked={pullDefaults.noFastForward}
                                    onChange={(e) => {
                                        const next = { ...pullDefaults, noFastForward: e.target.checked };
                                        onPullDefaultsChange(next);
                                    }}
                                />
                                <span>{$t('git.noFastForward')}</span>
                            </label>
                            <label className="git-graph-settings-checkbox">
                                <input
                                    type="checkbox"
                                    checked={pullDefaults.squash}
                                    onChange={(e) => {
                                        const next = { ...pullDefaults, squash: e.target.checked };
                                        onPullDefaultsChange(next);
                                    }}
                                />
                                <span>{$t('git.squashOption')}</span>
                            </label>
                        </div>
                    </div>
                </section>

                <section className="git-graph-settings-group">
                    <div className="git-graph-settings-group-header">
                        <h2>{$t('git.extensionSettings')}</h2>
                    </div>
                    <div className="git-graph-settings-group-content">
                        <div className="git-graph-settings-section">
                            <h3>{$t('git.fileHistorySplit')}</h3>
                            <p className="git-graph-settings-hint">
                                {$t('git.fileHistorySplitHint')}
                            </p>
                            <label className="git-graph-settings-radio">
                                <input
                                    type="radio"
                                    name="file-history-split"
                                    checked={fileHistorySplitLayout === 'vertical'}
                                    onChange={() => onFileHistorySplitLayoutChange('vertical')}
                                />
                                <span>{$t('git.splitVertical')}</span>
                            </label>
                            <label className="git-graph-settings-radio">
                                <input
                                    type="radio"
                                    name="file-history-split"
                                    checked={fileHistorySplitLayout === 'horizontal'}
                                    onChange={() => onFileHistorySplitLayoutChange('horizontal')}
                                />
                                <span>{$t('git.splitHorizontal')}</span>
                            </label>
                        </div>

                        <div className="git-graph-settings-section">
                            <h3>{$t('git.sourceControl')}</h3>
                            <p className="git-graph-settings-hint">
                                {$t('git.quickSyncButtonHint')}
                            </p>
                            <label className="git-graph-settings-checkbox">
                                <input
                                    type="checkbox"
                                    checked={showQuickSyncButton}
                                    onChange={(e) => {
                                        const next = e.target.checked;
                                        setShowQuickSyncButton(next);
                                        handler.emit('updateConfig', { key: 'gitHistory.quickSyncButton', value: next });
                                    }}
                                />
                                <span>{$t('git.showQuickSyncButton')}</span>
                            </label>
                        </div>
                    </div>
                </section>
            </div>
        </aside>
    );
}
