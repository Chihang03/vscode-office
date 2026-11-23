import { $t } from '../../../i18n/i18nConfig';

interface SelectionActionBarProps {
    count: number;
    onCopyHashes: () => void;
    onCopyMessages: () => void;
    onCherryPick: () => void;
    onRevert: () => void;
    onExportDevLog: () => void;
    onClear: () => void;
}

export default function SelectionActionBar({
    count,
    onCopyHashes,
    onCopyMessages,
    onCherryPick,
    onRevert,
    onExportDevLog,
    onClear,
}: SelectionActionBarProps) {
    if (count < 2) {
        return null;
    }

    return (
        <div className="git-graph-selection-bar" role="toolbar" aria-label={$t('git.batchCommitActions')}>
            <span className="git-graph-selection-bar-count">{$t('git.commitsSelected', { count })}</span>
            <div className="git-graph-selection-bar-actions">
                <button type="button" className="git-graph-selection-bar-btn" onClick={onCopyHashes}>
                    <span className="codicon codicon-git-commit" aria-hidden />
                    {$t('git.copyCommitHash')}
                </button>
                <button type="button" className="git-graph-selection-bar-btn" onClick={onCopyMessages}>
                    <span className="codicon codicon-copy" aria-hidden />
                    {$t('git.copyCommitMessage')}
                </button>
                <button type="button" className="git-graph-selection-bar-btn" onClick={onCherryPick}>
                    <span className="codicon codicon-git-compare" aria-hidden />
                    {$t('git.cherryPick')}
                </button>
                <button type="button" className="git-graph-selection-bar-btn git-graph-selection-bar-btn-danger" onClick={onRevert}>
                    <span className="codicon codicon-discard" aria-hidden />
                    {$t('git.revert')}
                </button>
                <button type="button" className="git-graph-selection-bar-btn" onClick={onExportDevLog}>
                    <span className="codicon codicon-export" aria-hidden />
                    {$t('git.devLog.exportBtn')}
                </button>
                <button type="button" className="git-graph-selection-bar-btn git-graph-selection-bar-btn-ghost" onClick={onClear}>
                    {$t('git.clear')}
                </button>
            </div>
        </div>
    );
}
