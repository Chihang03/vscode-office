import type { MouseEvent } from 'react';
import { $t } from '../../../i18n/i18nConfig';
import VscodeDropdown from './VscodeDropdown';
import { FetchIcon, PullIcon, PushIcon, RefreshIcon, RemoteIcon, FindIcon, SettingsIcon, ThemeToggleIcon, ExpandLayoutIcon, ExportIcon } from './ToolbarIcons';

interface ToolbarProps {
    repos: string[];
    repo: string;
    branches: string[];
    selectedBranch: string | null;
    authors: string[];
    selectedAuthor: string | undefined;
    searchValue: string;
    refreshing: boolean;
    fetching: boolean;
    pulling: boolean;
    pushing: boolean;
    canPull: boolean;
    canPush: boolean;
    hasRemoteUrl: boolean;
    findActive: boolean;
    settingsActive: boolean;
    splitView: boolean;
    adaptiveColorMode: boolean;
    onRepoChange: (repo: string) => void;
    onBranchChange: (branch: string | null) => void;
    onAuthorChange: (author: string | undefined) => void;
    onSearchChange: (value: string) => void;
    onSearch: () => void;
    onFetch: () => void;
    onPull: (event: MouseEvent<HTMLButtonElement>) => void;
    onPush: (event: MouseEvent<HTMLButtonElement>) => void;
    onOpenRemote: (event: MouseEvent<HTMLButtonElement>) => void;
    onToggleFind: () => void;
    onRefresh: () => void;
    onToggleSettings: () => void;
    onExpandLayout: () => void;
    onToggleColorMode: () => void;
    onExportDevLog: () => void;
}

function repoLabel(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || path;
}

export default function Toolbar({
    repos, repo, branches, selectedBranch, authors, selectedAuthor,
    searchValue, refreshing, fetching, pulling, pushing, canPull, canPush, hasRemoteUrl,
    findActive, settingsActive, splitView, adaptiveColorMode,
    onRepoChange, onBranchChange, onAuthorChange,
    onSearchChange, onSearch,
    onFetch, onPull, onPush, onOpenRemote, onToggleFind, onRefresh, onToggleSettings, onExpandLayout, onToggleColorMode, onExportDevLog,
}: ToolbarProps) {
    const showRepo = repos.length > 1;
    const remoteOpClass = fetching
        ? ' git-graph-toolbar--fetching'
        : pulling
            ? ' git-graph-toolbar--pulling'
            : pushing
                ? ' git-graph-toolbar--pushing'
                : '';

    return (
        <div className={`git-graph-toolbar${showRepo ? '' : ' single-repo'}${remoteOpClass}`}>
            <div className="git-graph-toolbar-search">
                <input
                    type="text"
                    className="vscode-input"
                    placeholder={$t('git.searchPlaceholder')}
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
                />
            </div>

            <div className="git-graph-toolbar-filters">
                {showRepo && (
                    <VscodeDropdown
                        label={$t('git.repoLabel')}
                        options={repos.map((r) => ({ value: r, label: repoLabel(r), hint: r }))}
                        value={repo}
                        filterPlaceholder={$t('git.filterRepos')}
                        showAllOption={false}
                        onChange={(v) => { if (typeof v === 'string' && v) onRepoChange(v); }}
                    />
                )}
                <VscodeDropdown
                    label={$t('git.branchLabel')}
                    options={branches.map((b) => ({ value: b, label: b }))}
                    value={selectedBranch ?? ''}
                    allLabel={$t('git.all')}
                    filterPlaceholder={$t('git.filterBranches')}
                    onChange={(v) => onBranchChange(typeof v === 'string' && v ? v : null)}
                />
                <VscodeDropdown
                    label={$t('git.authorLabel')}
                    variant="toolbar"
                    triggerLabel={selectedAuthor ? undefined : $t('git.authorLabel')}
                    options={authors.map((a) => ({ value: a, label: a }))}
                    value={selectedAuthor ?? ''}
                    allLabel={$t('git.all')}
                    filterPlaceholder={$t('git.filterAuthors')}
                    onChange={(v) => onAuthorChange(typeof v === 'string' && v ? v : undefined)}
                />
            </div>

            <div className="git-graph-toolbar-actions">
                <RefreshIcon
                    title={$t('git.refresh')}
                    onClick={onRefresh}
                    disabled={refreshing}
                    className={refreshing ? ' spinning' : ''}
                />
                <FetchIcon
                    title={$t('git.fetchTooltip')}
                    onClick={onFetch}
                    disabled={fetching || pushing || pulling || !repo}
                    className={fetching ? 'running' : undefined}
                />
                <PullIcon
                    title={$t('git.pullTooltip')}
                    onClick={onPull}
                    disabled={pulling || pushing || fetching || !canPull}
                    className={pulling ? 'running' : undefined}
                />
                <PushIcon
                    title={$t('git.pushTooltip')}
                    onClick={onPush}
                    disabled={pushing || fetching || pulling || !canPush}
                    className={pushing ? 'running' : undefined}
                />
                <RemoteIcon
                    title={hasRemoteUrl ? $t('git.openRemoteTooltip') : $t('git.noRemoteUrlTooltip')}
                    onClick={onOpenRemote}
                    disabled={!repo || !hasRemoteUrl}
                />
            </div>

            <div className="git-graph-toolbar-tools">
                {splitView && (
                    <ExpandLayoutIcon
                        title={$t('git.expandLayoutTooltip')}
                        onClick={onExpandLayout}
                    />
                )}
                <ThemeToggleIcon adaptive={adaptiveColorMode} onClick={onToggleColorMode} />
                <FindIcon
                    title={$t('git.findTooltip')}
                    onClick={onToggleFind}
                    className={findActive ? 'active' : undefined}
                    disabled={!repo}
                />
                <ExportIcon
                    title={$t('git.devLog.exportTooltip')}
                    onClick={onExportDevLog}
                    disabled={!repo}
                />
                <SettingsIcon
                    title={$t('git.repoSettingsTooltip')}
                    onClick={onToggleSettings}
                    className={settingsActive ? 'active' : undefined}
                    disabled={!repo}
                />
            </div>
        </div>
    );
}
