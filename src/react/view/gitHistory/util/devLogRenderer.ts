import { $t } from '../../../i18n/i18nConfig';
import type { GitCommit } from '../types';
import { computeGraphLayout, type GraphConfig } from '../graph/layoutEngine';
import { getBranchLabels } from './branchLabels';

export type DevLogTemplate = 'timeline' | 'report' | 'graph';
export type DevLogRangePreset = 'current' | 'selected' | '7d' | '30d' | 'custom';
export type DevLogTheme = 'light' | 'dark';

export interface DevLogFileStat {
    path: string;
    additions: number;
    deletions: number;
}

export interface DevLogCommitStat {
    body: string;
    additions: number;
    deletions: number;
    filesChanged: number;
    files: DevLogFileStat[];
}

export interface DevLogOptions {
    template: DevLogTemplate;
    rangePreset: DevLogRangePreset;
    dateFrom: string; // YYYY-MM-DD
    dateTo: string;   // YYYY-MM-DD
    includeStats: boolean;
    excludeMerges: boolean;
    includeBody: boolean;
    includeFiles: boolean;
    groupByType: boolean;
    theme: DevLogTheme;
}

export interface DevLogRenderContext {
    repoName: string;
    branchLabel: string;
    commitHead: string | null;
    commits: ReadonlyArray<GitCommit>;
    stats: Readonly<Record<string, DevLogCommitStat>>;
    options: DevLogOptions;
    graphConfig: GraphConfig;
    generatedAt: string;
}

interface CommitCategoryMeta {
    key: string;
    labelKey: string;
    color: string;
    bgLight: string;
    bgDark: string;
}

const CATEGORY_ORDER: CommitCategoryMeta[] = [
    { key: 'feat', labelKey: 'git.devLog.typeFeat', color: '#2563eb', bgLight: '#eff6ff', bgDark: 'rgba(59,130,246,0.18)' },
    { key: 'fix', labelKey: 'git.devLog.typeFix', color: '#dc2626', bgLight: '#fef2f2', bgDark: 'rgba(239,68,68,0.18)' },
    { key: 'perf', labelKey: 'git.devLog.typePerf', color: '#d97706', bgLight: '#fffbeb', bgDark: 'rgba(245,158,11,0.18)' },
    { key: 'refactor', labelKey: 'git.devLog.typeRefactor', color: '#7c3aed', bgLight: '#f5f3ff', bgDark: 'rgba(139,92,246,0.18)' },
    { key: 'docs', labelKey: 'git.devLog.typeDocs', color: '#0891b2', bgLight: '#ecfeff', bgDark: 'rgba(6,182,212,0.18)' },
    { key: 'style', labelKey: 'git.devLog.typeStyle', color: '#db2777', bgLight: '#fdf2f8', bgDark: 'rgba(236,72,153,0.18)' },
    { key: 'test', labelKey: 'git.devLog.typeTest', color: '#059669', bgLight: '#ecfdf5', bgDark: 'rgba(16,185,129,0.18)' },
    { key: 'chore', labelKey: 'git.devLog.typeChore', color: '#4b5563', bgLight: '#f3f4f6', bgDark: 'rgba(156,163,175,0.18)' },
    { key: 'other', labelKey: 'git.devLog.typeOther', color: '#6b7280', bgLight: '#f3f4f6', bgDark: 'rgba(156,163,175,0.15)' },
];

const CATEGORY_MAP = new Map(CATEGORY_ORDER.map((c) => [c.key, c]));

const AVATAR_COLORS = [
    '#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#4f46e5',
];

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function pad2(n: number): string {
    return n.toString().padStart(2, '0');
}

export function formatDateYmd(timestampSec: number): string {
    const d = new Date(timestampSec * 1000);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatDateTimeShort(timestampSec: number): string {
    const d = new Date(timestampSec * 1000);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatTimeHm(timestampSec: number): string {
    const d = new Date(timestampSec * 1000);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function classifyCommit(message: string): CommitCategoryMeta {
    const match = /^([a-zA-Z]+)(?:\([^)]*\))?!?\s*:/.exec(message.trim());
    if (match) {
        const prefix = match[1].toLowerCase();
        if (prefix === 'build' || prefix === 'ci' || prefix === 'release') {
            return CATEGORY_MAP.get('chore')!;
        }
        const found = CATEGORY_MAP.get(prefix);
        if (found) return found;
    }
    return CATEGORY_MAP.get('other')!;
}

function getAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
}

function extractCommitBody(stat: DevLogCommitStat | undefined, subject: string): string {
    if (!stat?.body) return '';
    const trimmed = stat.body.trim();
    if (!trimmed || trimmed === subject.trim()) return '';
    const lines = trimmed.split(/\r?\n/);
    if (lines[0].trim() === subject.trim()) {
        return lines.slice(1).join('\n').trim();
    }
    return trimmed;
}

export function filterCommitsForDevLog(
    allCommits: ReadonlyArray<GitCommit>,
    selectedCommits: ReadonlyArray<GitCommit>,
    options: DevLogOptions,
    nowMs: number = Date.now(),
): GitCommit[] {
    const base = options.rangePreset === 'selected' && selectedCommits.length > 0
        ? selectedCommits
        : allCommits;

    const realCommits = base.filter((c) => c.hash !== '*' && !c.stash);
    const filtered: GitCommit[] = [];

    let minTs = -Infinity;
    let maxTs = Infinity;

    if (options.rangePreset === '7d') {
        minTs = Math.floor(nowMs / 1000) - 7 * 24 * 60 * 60;
    } else if (options.rangePreset === '30d') {
        minTs = Math.floor(nowMs / 1000) - 30 * 24 * 60 * 60;
    } else if (options.rangePreset === 'custom') {
        if (options.dateFrom) {
            const parsed = new Date(`${options.dateFrom}T00:00:00`).getTime();
            if (!Number.isNaN(parsed)) minTs = Math.floor(parsed / 1000);
        }
        if (options.dateTo) {
            const parsed = new Date(`${options.dateTo}T23:59:59`).getTime();
            if (!Number.isNaN(parsed)) maxTs = Math.floor(parsed / 1000);
        }
    }

    for (const c of realCommits) {
        if (options.excludeMerges && c.parents.length > 1) {
            continue;
        }
        if (c.date < minTs || c.date > maxTs) {
            continue;
        }
        filtered.push(c);
    }
    return filtered;
}

interface SummaryMetrics {
    commitCount: number;
    activeDays: number;
    authorCount: number;
    totalAdditions: number;
    totalDeletions: number;
    hasLineStats: boolean;
    dateSpan: string;
    dailyCounts: { date: string; count: number }[];
    authors: { name: string; count: number; additions: number; deletions: number }[];
    categories: { meta: CommitCategoryMeta; count: number }[];
}

function computeSummary(
    commits: ReadonlyArray<GitCommit>,
    stats: Readonly<Record<string, DevLogCommitStat>>,
): SummaryMetrics {
    const dayMap = new Map<string, number>();
    const authorMap = new Map<string, { name: string; count: number; additions: number; deletions: number }>();
    const catMap = new Map<string, number>();
    let totalAdditions = 0;
    let totalDeletions = 0;
    let hasLineStats = false;

    for (const c of commits) {
        const day = formatDateYmd(c.date);
        dayMap.set(day, (dayMap.get(day) ?? 0) + 1);

        const stat = stats[c.hash];
        const add = stat?.additions ?? 0;
        const del = stat?.deletions ?? 0;
        if (stat) {
            hasLineStats = true;
            totalAdditions += add;
            totalDeletions += del;
        }

        const authorName = c.author || 'Unknown';
        const existing = authorMap.get(authorName);
        if (existing) {
            existing.count += 1;
            existing.additions += add;
            existing.deletions += del;
        } else {
            authorMap.set(authorName, { name: authorName, count: 1, additions: add, deletions: del });
        }

        const cat = classifyCommit(c.message);
        catMap.set(cat.key, (catMap.get(cat.key) ?? 0) + 1);
    }

    const dailyCounts = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));

    const dateSpan = dailyCounts.length === 0
        ? ''
        : dailyCounts.length === 1
            ? dailyCounts[0].date
            : `${dailyCounts[0].date} ~ ${dailyCounts[dailyCounts.length - 1].date}`;

    const authors = Array.from(authorMap.values()).sort((a, b) => b.count - a.count);
    const categories = CATEGORY_ORDER
        .filter((m) => (catMap.get(m.key) ?? 0) > 0)
        .map((meta) => ({ meta, count: catMap.get(meta.key)! }));

    return {
        commitCount: commits.length,
        activeDays: dayMap.size,
        authorCount: authorMap.size,
        totalAdditions,
        totalDeletions,
        hasLineStats,
        dateSpan,
        dailyCounts,
        authors,
        categories,
    };
}

function renderRefBadgesHtml(commit: GitCommit): string {
    const labels = getBranchLabels(commit.heads, commit.remotes);
    const parts: string[] = [];
    for (const h of labels.heads) {
        parts.push(`<span class="badge badge-branch">${escapeHtml(h.name)}</span>`);
    }
    for (const t of commit.tags) {
        parts.push(`<span class="badge badge-tag">${escapeHtml(t.name)}</span>`);
    }
    for (const r of labels.remotes.slice(0, 2)) {
        parts.push(`<span class="badge badge-remote">${escapeHtml(r.name)}</span>`);
    }
    return parts.join('');
}

function renderDailyActivitySvg(dailyCounts: { date: string; count: number }[], isDark: boolean): string {
    if (dailyCounts.length === 0) return '';
    const slice = dailyCounts.slice(-28);
    const maxCount = Math.max(...slice.map((d) => d.count), 1);
    const barGap = 4;
    const width = 460;
    const height = 74;
    const chartBottom = 56;
    const chartTop = 10;
    const chartH = chartBottom - chartTop;
    const barW = Math.max(6, Math.min(20, Math.floor((width - barGap * (slice.length - 1)) / slice.length)));
    const totalW = slice.length * barW + Math.max(0, slice.length - 1) * barGap;
    const barFill = isDark ? '#60a5fa' : '#3b82f6';
    const labelColor = isDark ? '#94a3b8' : '#64748b';

    const bars = slice.map((item, idx) => {
        const h = Math.max(4, Math.round((item.count / maxCount) * chartH));
        const x = idx * (barW + barGap);
        const y = chartBottom - h;
        const showLabel = idx === 0 || idx === slice.length - 1 || (slice.length <= 10) || idx % Math.ceil(slice.length / 6) === 0;
        const shortDate = item.date.slice(5);
        return `
            <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="${barFill}" opacity="${0.45 + 0.55 * (item.count / maxCount)}">
                <title>${escapeHtml(item.date)}: ${item.count}</title>
            </rect>
            ${showLabel ? `<text x="${x + barW / 2}" y="${height - 4}" text-anchor="middle" font-size="9" fill="${labelColor}">${escapeHtml(shortDate)}</text>` : ''}
        `;
    }).join('');

    return `<svg viewBox="0 0 ${Math.max(totalW, 120)} ${height}" width="100%" height="${height}" preserveAspectRatio="xMinYMid meet" style="display:block;max-width:100%;">${bars}</svg>`;
}

function renderFileStatsHtml(stat: DevLogCommitStat | undefined, showFileList: boolean): string {
    if (!stat || stat.filesChanged === 0) return '';
    const summary = `
        <span class="file-stat-pill">
            <span>${escapeHtml($t('git.devLog.filesCount', { count: stat.filesChanged }))}</span>
            ${stat.additions > 0 ? `<span class="stat-add">+${stat.additions}</span>` : ''}
            ${stat.deletions > 0 ? `<span class="stat-del">-${stat.deletions}</span>` : ''}
        </span>
    `;
    if (!showFileList || stat.files.length === 0) {
        return summary;
    }
    const maxFiles = 12;
    const visible = stat.files.slice(0, maxFiles);
    const hidden = stat.files.length - visible.length;
    const rows = visible.map((f) => `
        <div class="file-list-row">
            <span class="file-list-path">${escapeHtml(f.path)}</span>
            <span class="file-list-nums">
                ${f.additions > 0 ? `<span class="stat-add">+${f.additions}</span>` : ''}
                ${f.deletions > 0 ? `<span class="stat-del">-${f.deletions}</span>` : ''}
            </span>
        </div>
    `).join('');
    const more = hidden > 0 ? `<div class="file-list-more">+ ${hidden} ...</div>` : '';
    return `${summary}<div class="file-list">${rows}${more}</div>`;
}

function buildBaseStyles(isDark: boolean, template: DevLogTemplate): string {
    const bg = isDark ? '#0f172a' : (template === 'report' ? '#ffffff' : '#f8fafc');
    const surface = isDark ? '#1e293b' : '#ffffff';
    const surfaceSubtle = isDark ? '#162032' : '#f1f5f9';
    const text = isDark ? '#e2e8f0' : '#0f172a';
    const textMuted = isDark ? '#94a3b8' : '#64748b';
    const border = isDark ? '#334155' : '#e2e8f0';
    const accent = isDark ? '#60a5fa' : '#2563eb';
    const addColor = isDark ? '#4ade80' : '#16a34a';
    const delColor = isDark ? '#f87171' : '#dc2626';

    return `
        :root {
            --bg: ${bg};
            --surface: ${surface};
            --surface-subtle: ${surfaceSubtle};
            --text: ${text};
            --text-muted: ${textMuted};
            --border: ${border};
            --accent: ${accent};
            --add: ${addColor};
            --del: ${delColor};
        }
        * { box-sizing: border-box; }
        html, body {
            margin: 0;
            padding: 0;
            background: var(--bg);
            color: var(--text);
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 13px;
            line-height: 1.55;
            -webkit-font-smoothing: antialiased;
        }
        .page {
            max-width: ${template === 'graph' ? '1040px' : '920px'};
            margin: 0 auto;
            padding: ${template === 'report' ? '24px 28px 36px' : '28px 28px 40px'};
        }
        @media print {
            html, body { background: ${isDark ? bg : '#ffffff'}; }
            .page { max-width: none; padding: 0; }
        }
        .stat-add { color: var(--add); font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }
        .stat-del { color: var(--del); font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }
        .hash {
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 11px;
            color: var(--text-muted);
            background: var(--surface-subtle);
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid var(--border);
        }
        .badge {
            display: inline-block;
            max-width: 175px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex-shrink: 0;
            font-size: 10.5px;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 4px;
            margin-right: 4px;
            vertical-align: middle;
            line-height: 1.4;
        }
        .badge-branch { background: ${isDark ? 'rgba(59,130,246,0.22)' : '#dbeafe'}; color: ${isDark ? '#93c5fd' : '#1d4ed8'}; }
        .badge-tag { background: ${isDark ? 'rgba(245,158,11,0.22)' : '#fef3c7'}; color: ${isDark ? '#fcd34d' : '#b45309'}; }
        .badge-remote { background: ${isDark ? 'rgba(148,163,184,0.18)' : '#e2e8f0'}; color: ${isDark ? '#cbd5e1' : '#475569'}; }
        .cat-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 999px;
        }
        .commit-body {
            margin-top: 6px;
            padding: 8px 10px;
            background: var(--surface-subtle);
            border-left: 3px solid var(--border);
            border-radius: 4px;
            font-size: 12px;
            color: var(--text-muted);
            white-space: pre-wrap;
            word-break: break-word;
        }
        .file-stat-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: var(--text-muted);
            background: var(--surface-subtle);
            border: 1px solid var(--border);
            border-radius: 4px;
            padding: 1px 7px;
        }
        .file-list {
            margin-top: 6px;
            padding: 6px 10px;
            background: var(--surface-subtle);
            border-radius: 6px;
            border: 1px solid var(--border);
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 11px;
        }
        .file-list-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 2px 0;
        }
        .file-list-path {
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .file-list-nums {
            flex-shrink: 0;
            display: inline-flex;
            gap: 6px;
        }
        .file-list-more {
            color: var(--text-muted);
            padding-top: 2px;
        }
        .empty-state {
            text-align: center;
            padding: 48px 24px;
            color: var(--text-muted);
            background: var(--surface);
            border: 1px dashed var(--border);
            border-radius: 12px;
        }
    `;
}

// ============================================================================
// Template A: Card Timeline (Visual sharing / weekly report card)
// ============================================================================
function renderTimelineHtml(ctx: DevLogRenderContext, summary: SummaryMetrics): string {
    const isDark = ctx.options.theme === 'dark';
    const dayGroups = new Map<string, GitCommit[]>();
    for (const c of ctx.commits) {
        const day = formatDateYmd(c.date);
        const list = dayGroups.get(day);
        if (list) list.push(c);
        else dayGroups.set(day, [c]);
    }

    const metricsHtml = ctx.options.includeStats ? `
        <div class="tl-metrics">
            <div class="tl-metric-card">
                <div class="tl-metric-val">${summary.commitCount}</div>
                <div class="tl-metric-label">${escapeHtml($t('git.devLog.statCommits'))}</div>
            </div>
            <div class="tl-metric-card">
                <div class="tl-metric-val">${summary.activeDays}</div>
                <div class="tl-metric-label">${escapeHtml($t('git.devLog.statActiveDays'))}</div>
            </div>
            <div class="tl-metric-card">
                <div class="tl-metric-val">${summary.authorCount}</div>
                <div class="tl-metric-label">${escapeHtml($t('git.devLog.statAuthors'))}</div>
            </div>
            <div class="tl-metric-card">
                <div class="tl-metric-val tl-metric-changes">
                    ${summary.hasLineStats
                        ? `<span class="stat-add" style="font-size:16px">+${summary.totalAdditions}</span> <span class="stat-del" style="font-size:16px">-${summary.totalDeletions}</span>`
                        : `<span style="color:var(--text-muted)">—</span>`}
                </div>
                <div class="tl-metric-label">${escapeHtml($t('git.devLog.statChanges'))}</div>
            </div>
        </div>
        ${(summary.dailyCounts.length > 1 || summary.categories.length > 0) ? `
            <div class="tl-charts">
                ${summary.dailyCounts.length > 1 ? `
                    <div class="tl-chart-box">
                        <div class="tl-chart-title">${escapeHtml($t('git.devLog.dailyActivity'))}</div>
                        ${renderDailyActivitySvg(summary.dailyCounts, isDark)}
                    </div>
                ` : ''}
                ${summary.categories.length > 0 ? `
                    <div class="tl-chart-box">
                        <div class="tl-chart-title">${escapeHtml($t('git.devLog.typeBreakdown'))}</div>
                        <div class="tl-cat-pills">
                            ${summary.categories.map(({ meta, count }) => `
                                <span class="cat-pill" style="background:${isDark ? meta.bgDark : meta.bgLight};color:${meta.color};">
                                    <span>${escapeHtml($t(meta.labelKey))}</span>
                                    <strong>${count}</strong>
                                </span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        ` : ''}
    ` : '';

    const timelineBody = ctx.commits.length === 0
        ? `<div class="empty-state">${escapeHtml($t('git.devLog.noCommitsInRange'))}</div>`
        : Array.from(dayGroups.entries()).map(([day, list]) => {
            const cards = list.map((c) => {
                const cat = classifyCommit(c.message);
                const stat = ctx.stats[c.hash];
                const body = ctx.options.includeBody ? extractCommitBody(stat, c.message) : '';
                const avatarBg = getAvatarColor(c.author);
                return `
                    <div class="tl-item">
                        <div class="tl-dot" style="border-color:${cat.color};"></div>
                        <div class="tl-card">
                            <div class="tl-card-top">
                                <span class="cat-pill" style="background:${isDark ? cat.bgDark : cat.bgLight};color:${cat.color};">${escapeHtml($t(cat.labelKey))}</span>
                                ${renderRefBadgesHtml(c)}
                                <span class="tl-card-title">${escapeHtml(c.message)}</span>
                            </div>
                            <div class="tl-card-meta">
                                <span class="tl-author">
                                    <span class="tl-avatar" style="background:${avatarBg};">${escapeHtml(getInitials(c.author))}</span>
                                    <span>${escapeHtml(c.author)}</span>
                                </span>
                                <span class="tl-time">${escapeHtml(formatTimeHm(c.date))}</span>
                                <span class="hash">${escapeHtml(c.hash.slice(0, 7))}</span>
                                ${ctx.options.includeFiles && stat ? renderFileStatsHtml(stat, false) : ''}
                            </div>
                            ${body ? `<div class="commit-body">${escapeHtml(body)}</div>` : ''}
                            ${ctx.options.includeFiles && stat && stat.files.length > 0 ? `
                                <div class="file-list">
                                    ${stat.files.slice(0, 8).map((f) => `
                                        <div class="file-list-row">
                                            <span class="file-list-path">${escapeHtml(f.path)}</span>
                                            <span class="file-list-nums">
                                                ${f.additions > 0 ? `<span class="stat-add">+${f.additions}</span>` : ''}
                                                ${f.deletions > 0 ? `<span class="stat-del">-${f.deletions}</span>` : ''}
                                            </span>
                                        </div>
                                    `).join('')}
                                    ${stat.files.length > 8 ? `<div class="file-list-more">+ ${stat.files.length - 8} ...</div>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <section class="tl-day-group">
                    <div class="tl-day-header">
                        <span class="tl-day-badge">${escapeHtml(day)}</span>
                        <span class="tl-day-count">${list.length}</span>
                    </div>
                    <div class="tl-day-list">${cards}</div>
                </section>
            `;
        }).join('');

    const extraCss = `
        .tl-hero {
            background: ${isDark
                ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                : 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)'};
            color: #ffffff;
            border-radius: 14px;
            padding: 22px 24px;
            margin-bottom: 18px;
            border: 1px solid ${isDark ? '#334155' : 'transparent'};
        }
        .tl-hero-title { font-size: 22px; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.01em; }
        .tl-hero-sub { display: flex; flex-wrap: wrap; gap: 10px 18px; font-size: 12px; opacity: 0.9; }
        .tl-metrics {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 16px;
        }
        .tl-metric-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 12px 14px;
        }
        .tl-metric-val { font-size: 20px; font-weight: 700; color: var(--text); line-height: 1.25; }
        .tl-metric-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
        .tl-charts {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
        }
        .tl-chart-box {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 12px 14px;
        }
        .tl-chart-title { font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; }
        .tl-cat-pills { display: flex; flex-wrap: wrap; gap: 6px; }
        .tl-day-group { margin-bottom: 20px; }
        .tl-day-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .tl-day-badge {
            font-size: 12px;
            font-weight: 700;
            color: var(--accent);
            background: ${isDark ? 'rgba(59,130,246,0.16)' : '#eff6ff'};
            padding: 3px 10px;
            border-radius: 999px;
        }
        .tl-day-count { font-size: 11px; color: var(--text-muted); }
        .tl-day-list {
            position: relative;
            padding-left: 20px;
            border-left: 2px solid var(--border);
            margin-left: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .tl-item { position: relative; break-inside: avoid; }
        .tl-dot {
            position: absolute;
            left: -26px;
            top: 14px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--bg);
            border: 2.5px solid var(--accent);
        }
        .tl-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 11px 14px;
        }
        .tl-card-top { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 6px; }
        .tl-card-title { font-size: 13.5px; font-weight: 600; color: var(--text); word-break: break-word; }
        .tl-card-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 11.5px; color: var(--text-muted); }
        .tl-author { display: inline-flex; align-items: center; gap: 5px; font-weight: 500; color: var(--text); }
        .tl-avatar {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            color: #ffffff;
            font-size: 9px;
            font-weight: 700;
        }
        .tl-footer {
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: var(--text-muted);
        }
    `;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(ctx.repoName)} - ${escapeHtml($t('git.devLog.templateTimeline'))}</title>
<style>${buildBaseStyles(isDark, 'timeline')}${extraCss}</style>
</head>
<body>
<div class="page">
    <header class="tl-hero">
        <h1 class="tl-hero-title">${escapeHtml(ctx.repoName)}</h1>
        <div class="tl-hero-sub">
            <span>${escapeHtml($t('git.devLog.branchScope', { branch: ctx.branchLabel }))}</span>
            ${summary.dateSpan ? `<span>${escapeHtml(summary.dateSpan)}</span>` : ''}
            <span>${escapeHtml($t('git.devLog.generatedAt', { date: ctx.generatedAt }))}</span>
        </div>
    </header>
    ${metricsHtml}
    <main>${timelineBody}</main>
    <footer class="tl-footer">
        <span>Kieran Document Studio · ${escapeHtml(ctx.repoName)}</span>
        <span>${escapeHtml($t('git.devLog.generatedAt', { date: ctx.generatedAt }))}</span>
    </footer>
</div>
</body>
</html>`;
}

// ============================================================================
// Template B: Formal Paginated Report (Structured A4 PDF report)
// ============================================================================
function renderReportHtml(ctx: DevLogRenderContext, summary: SummaryMetrics): string {
    const isDark = ctx.options.theme === 'dark';

    const summarySection = ctx.options.includeStats ? `
        <section class="rp-section">
            <div class="rp-kpi-grid">
                <div class="rp-kpi">
                    <span class="rp-kpi-label">${escapeHtml($t('git.devLog.statCommits'))}</span>
                    <strong class="rp-kpi-val">${summary.commitCount}</strong>
                </div>
                <div class="rp-kpi">
                    <span class="rp-kpi-label">${escapeHtml($t('git.devLog.statActiveDays'))}</span>
                    <strong class="rp-kpi-val">${summary.activeDays}</strong>
                </div>
                <div class="rp-kpi">
                    <span class="rp-kpi-label">${escapeHtml($t('git.devLog.statAuthors'))}</span>
                    <strong class="rp-kpi-val">${summary.authorCount}</strong>
                </div>
                <div class="rp-kpi">
                    <span class="rp-kpi-label">${escapeHtml($t('git.devLog.statChanges'))}</span>
                    <strong class="rp-kpi-val">
                        ${summary.hasLineStats
                            ? `<span class="stat-add" style="font-size:15px">+${summary.totalAdditions}</span> / <span class="stat-del" style="font-size:15px">-${summary.totalDeletions}</span>`
                            : '—'}
                    </strong>
                </div>
            </div>
            ${summary.authors.length > 0 ? `
                <h2 class="rp-h2">${escapeHtml($t('git.devLog.authorBreakdown'))}</h2>
                <table class="rp-table">
                    <thead>
                        <tr>
                            <th>${escapeHtml($t('git.devLog.authorCol'))}</th>
                            <th style="width:90px;text-align:right;">${escapeHtml($t('git.devLog.commitsCol'))}</th>
                            <th style="width:160px;">${escapeHtml($t('git.devLog.shareCol'))}</th>
                            ${summary.hasLineStats ? `<th style="width:140px;text-align:right;">${escapeHtml($t('git.devLog.changesCol'))}</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.authors.map((a) => {
                            const pct = summary.commitCount > 0 ? Math.round((a.count / summary.commitCount) * 100) : 0;
                            return `
                                <tr>
                                    <td><strong>${escapeHtml(a.name)}</strong></td>
                                    <td style="text-align:right;">${a.count}</td>
                                    <td>
                                        <div class="rp-bar-wrap">
                                            <div class="rp-bar-track"><div class="rp-bar-fill" style="width:${pct}%"></div></div>
                                            <span class="rp-bar-pct">${pct}%</span>
                                        </div>
                                    </td>
                                    ${summary.hasLineStats ? `
                                        <td style="text-align:right;">
                                            <span class="stat-add">+${a.additions}</span>
                                            <span class="stat-del">-${a.deletions}</span>
                                        </td>
                                    ` : ''}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            ` : ''}
        </section>
    ` : '';

    const renderCommitRow = (c: GitCommit): string => {
        const stat = ctx.stats[c.hash];
        const body = ctx.options.includeBody ? extractCommitBody(stat, c.message) : '';
        return `
            <div class="rp-entry">
                <div class="rp-entry-main">
                    <div class="rp-entry-title">
                        ${renderRefBadgesHtml(c)}
                        <span>${escapeHtml(c.message)}</span>
                    </div>
                    <div class="rp-entry-meta">
                        <span>${escapeHtml(c.author)}</span>
                        <span>·</span>
                        <span>${escapeHtml(formatDateTimeShort(c.date))}</span>
                        <span>·</span>
                        <span class="hash">${escapeHtml(c.hash.slice(0, 7))}</span>
                        ${ctx.options.includeFiles && stat ? renderFileStatsHtml(stat, false) : ''}
                    </div>
                </div>
                ${body ? `<div class="commit-body">${escapeHtml(body)}</div>` : ''}
                ${ctx.options.includeFiles && stat && stat.files.length > 0 ? renderFileStatsHtml(stat, true).replace(/^<span class="file-stat-pill">[\s\S]*?<\/span>/, '') : ''}
            </div>
        `;
    };

    let changelogBody = '';
    if (ctx.commits.length === 0) {
        changelogBody = `<div class="empty-state">${escapeHtml($t('git.devLog.noCommitsInRange'))}</div>`;
    } else if (ctx.options.groupByType) {
        const groups = new Map<string, GitCommit[]>();
        for (const c of ctx.commits) {
            const cat = classifyCommit(c.message);
            const list = groups.get(cat.key);
            if (list) list.push(c);
            else groups.set(cat.key, [c]);
        }
        changelogBody = CATEGORY_ORDER
            .filter((meta) => (groups.get(meta.key)?.length ?? 0) > 0)
            .map((meta) => {
                const items = groups.get(meta.key)!;
                return `
                    <div class="rp-group">
                        <h3 class="rp-h3">
                            <span class="rp-group-dot" style="background:${meta.color};"></span>
                            <span>${escapeHtml($t(meta.labelKey))}</span>
                            <span class="rp-group-count">(${items.length})</span>
                        </h3>
                        ${items.map(renderCommitRow).join('')}
                    </div>
                `;
            }).join('');
    } else {
        const dayGroups = new Map<string, GitCommit[]>();
        for (const c of ctx.commits) {
            const day = formatDateYmd(c.date);
            const list = dayGroups.get(day);
            if (list) list.push(c);
            else dayGroups.set(day, [c]);
        }
        changelogBody = Array.from(dayGroups.entries()).map(([day, items]) => `
            <div class="rp-group">
                <h3 class="rp-h3">
                    <span>${escapeHtml(day)}</span>
                    <span class="rp-group-count">(${items.length})</span>
                </h3>
                ${items.map(renderCommitRow).join('')}
            </div>
        `).join('');
    }

    const extraCss = `
        .rp-header {
            border-bottom: 2px solid var(--text);
            padding-bottom: 14px;
            margin-bottom: 20px;
        }
        .rp-kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); font-weight: 700; margin-bottom: 4px; }
        .rp-title { font-size: 24px; font-weight: 800; margin: 0 0 8px; }
        .rp-meta-row { display: flex; flex-wrap: wrap; gap: 16px; font-size: 12px; color: var(--text-muted); }
        .rp-section { margin-bottom: 22px; }
        .rp-kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            border: 1px solid var(--border);
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 18px;
        }
        .rp-kpi {
            padding: 12px 14px;
            background: var(--surface);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .rp-kpi:last-child { border-right: none; }
        .rp-kpi-label { font-size: 11px; color: var(--text-muted); }
        .rp-kpi-val { font-size: 18px; font-weight: 700; }
        .rp-h2 {
            font-size: 15px;
            font-weight: 700;
            margin: 18px 0 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid var(--border);
        }
        .rp-h3 {
            font-size: 13.5px;
            font-weight: 700;
            margin: 14px 0 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            page-break-after: avoid;
        }
        .rp-group-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .rp-group-count { font-weight: 400; color: var(--text-muted); font-size: 12px; }
        .rp-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 14px; }
        .rp-table th, .rp-table td { padding: 7px 10px; border-bottom: 1px solid var(--border); text-align: left; }
        .rp-table th { background: var(--surface-subtle); font-weight: 600; color: var(--text-muted); }
        .rp-bar-wrap { display: flex; align-items: center; gap: 8px; }
        .rp-bar-track { flex: 1; height: 6px; background: var(--surface-subtle); border-radius: 3px; overflow: hidden; }
        .rp-bar-fill { height: 100%; background: var(--accent); border-radius: 3px; }
        .rp-bar-pct { width: 34px; text-align: right; font-size: 11px; color: var(--text-muted); }
        .rp-entry {
            padding: 8px 0;
            border-bottom: 1px solid var(--border);
            break-inside: avoid;
        }
        .rp-entry:last-child { border-bottom: none; }
        .rp-entry-title { font-size: 13px; font-weight: 600; margin-bottom: 3px; word-break: break-word; }
        .rp-entry-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 11.5px; color: var(--text-muted); }
    `;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(ctx.repoName)} - ${escapeHtml($t('git.devLog.templateReport'))}</title>
<style>${buildBaseStyles(isDark, 'report')}${extraCss}</style>
</head>
<body>
<div class="page">
    <header class="rp-header">
        <div class="rp-kicker">${escapeHtml($t('git.devLog.templateReport'))}</div>
        <h1 class="rp-title">${escapeHtml(ctx.repoName)}</h1>
        <div class="rp-meta-row">
            <span>${escapeHtml($t('git.devLog.branchScope', { branch: ctx.branchLabel }))}</span>
            ${summary.dateSpan ? `<span>${escapeHtml(summary.dateSpan)}</span>` : ''}
            <span>${escapeHtml($t('git.devLog.generatedAt', { date: ctx.generatedAt }))}</span>
        </div>
    </header>
    ${summarySection}
    <section class="rp-section">
        <h2 class="rp-h2">${escapeHtml($t('git.devLog.changelogSection'))}</h2>
        ${changelogBody}
    </section>
</div>
</body>
</html>`;
}

// ============================================================================
// Template C: Branch Graph Snapshot (WYSIWYG Git Graph + Paginated Table)
// ============================================================================
interface GraphSegment {
    kind: 'vertical' | 'curve';
    x: number;
    d: string;
    minY: number;
    maxY: number;
    color: string;
    dashed: boolean;
    dimmed: boolean;
}

function extractGraphSegments(
    paths: ReadonlyArray<{ d: string; color: string; dashed: boolean; dimmed?: boolean }>,
): GraphSegment[] {
    const segments: GraphSegment[] = [];
    const cmdRe = /([MLC])([^MLC]+)/g;
    const pairRe = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;

    for (const p of paths) {
        let cx = 0;
        let cy = 0;
        let match: RegExpExecArray | null;
        cmdRe.lastIndex = 0;
        while ((match = cmdRe.exec(p.d)) !== null) {
            const type = match[1];
            const argsStr = match[2];
            const pts: [number, number][] = [];
            let pm: RegExpExecArray | null;
            pairRe.lastIndex = 0;
            while ((pm = pairRe.exec(argsStr)) !== null) {
                pts.push([parseFloat(pm[1]), parseFloat(pm[2])]);
            }
            if (pts.length === 0) continue;

            if (type === 'M') {
                [cx, cy] = pts[pts.length - 1];
            } else if (type === 'L') {
                for (const [nx, ny] of pts) {
                    const minY = Math.min(cy, ny);
                    const maxY = Math.max(cy, ny);
                    if (cx === nx) {
                        segments.push({
                            kind: 'vertical',
                            x: cx,
                            d: '',
                            minY,
                            maxY,
                            color: p.color,
                            dashed: p.dashed,
                            dimmed: Boolean(p.dimmed),
                        });
                    } else {
                        segments.push({
                            kind: 'curve',
                            x: cx,
                            d: `M${cx},${cy}L${nx},${ny}`,
                            minY,
                            maxY,
                            color: p.color,
                            dashed: p.dashed,
                            dimmed: Boolean(p.dimmed),
                        });
                    }
                    cx = nx;
                    cy = ny;
                }
            } else if (type === 'C' && pts.length >= 3) {
                for (let k = 0; k + 2 < pts.length; k += 3) {
                    const [c1x, c1y] = pts[k];
                    const [c2x, c2y] = pts[k + 1];
                    const [nx, ny] = pts[k + 2];
                    const minY = Math.min(cy, c1y, c2y, ny);
                    const maxY = Math.max(cy, c1y, c2y, ny);
                    segments.push({
                        kind: 'curve',
                        x: cx,
                        d: `M${cx},${cy}C${c1x},${c1y} ${c2x},${c2y} ${nx},${ny}`,
                        minY,
                        maxY,
                        color: p.color,
                        dashed: p.dashed,
                        dimmed: Boolean(p.dimmed),
                    });
                    cx = nx;
                    cy = ny;
                }
            }
        }
    }
    return segments;
}

function renderGraphSnapshotHtml(ctx: DevLogRenderContext, summary: SummaryMetrics): string {
    const isDark = ctx.options.theme === 'dark';
    const rowHeight = 28;
    const commits = [...ctx.commits];
    const layout = computeGraphLayout(
        commits,
        ctx.commitHead,
        rowHeight,
        ctx.graphConfig,
        false,
        false,
        false,
    );

    const svgBg = isDark ? '#1e293b' : '#ffffff';
    const graphWidth = Math.max(layout.width, 48);
    const segments = extractGraphSegments(layout.paths);

    const verticesByRow = new Map<number, typeof layout.vertices>();
    for (const v of layout.vertices) {
        const rowIdx = Math.max(0, Math.min(commits.length - 1, Math.floor(v.cy / rowHeight)));
        const list = verticesByRow.get(rowIdx);
        if (list) list.push(v);
        else verticesByRow.set(rowIdx, [v]);
    }

    const renderRowSvg = (rowIdx: number): string => {
        const rowTop = rowIdx * rowHeight;
        const rowBottom = rowTop + rowHeight;
        const pathParts: string[] = [];

        for (const seg of segments) {
            if (seg.maxY < rowTop - 2 || seg.minY > rowBottom + 2) {
                continue;
            }
            const d = seg.kind === 'vertical'
                ? `M${seg.x},${Math.max(seg.minY, rowTop - 1).toFixed(1)}L${seg.x},${Math.min(seg.maxY, rowBottom + 1).toFixed(1)}`
                : seg.d;
            const dashAttr = seg.dashed ? ` stroke-dasharray="4 2" stroke-dashoffset="${rowTop % 6}"` : '';
            const opAttr = seg.dimmed ? ' opacity="0.45"' : '';
            pathParts.push(`<path d="${d}" fill="none" stroke="${seg.color}" stroke-width="2"${dashAttr}${opAttr} />`);
        }

        const rowVertices = verticesByRow.get(rowIdx) ?? [];
        const vertexParts = rowVertices.map((v) => {
            const ring = v.isStash && !v.isCurrent
                ? `<circle cx="${v.cx}" cy="${v.cy}" r="5" fill="none" stroke="${v.color}" stroke-width="1.5" />`
                : '';
            const dot = `<circle cx="${v.cx}" cy="${v.cy}" r="${v.isCurrent ? 5.5 : 4}" fill="${v.isCurrent ? svgBg : v.color}"${v.isCurrent ? ` stroke="${v.color}" stroke-width="2.5"` : ''} />`;
            return `${ring}${dot}`;
        });

        return `<svg width="${graphWidth}" height="${rowHeight}" viewBox="0 ${rowTop} ${graphWidth} ${rowHeight}" style="display:block;width:${graphWidth}px;height:${rowHeight}px;">${pathParts.join('')}${vertexParts.join('')}</svg>`;
    };

    const rowsHtml = commits.map((c, idx) => {
        const stat = ctx.stats[c.hash];
        const statInline = ctx.options.includeFiles && stat && stat.filesChanged > 0
            ? `<span class="gs-stat"><span class="stat-add">+${stat.additions}</span> <span class="stat-del">-${stat.deletions}</span></span>`
            : '';
        return `
            <tr class="gs-tr">
                <td class="gs-td-graph">${renderRowSvg(idx)}</td>
                <td class="gs-td-msg">
                    <div class="gs-cell gs-col-msg">
                        ${renderRefBadgesHtml(c)}
                        <span class="gs-msg-text">${escapeHtml(c.message)}</span>
                        ${statInline}
                    </div>
                </td>
                <td class="gs-td-author"><div class="gs-cell gs-col-author">${escapeHtml(c.author)}</div></td>
                <td class="gs-td-date"><div class="gs-cell gs-col-date">${escapeHtml(formatDateTimeShort(c.date))}</div></td>
                <td class="gs-td-hash"><div class="gs-cell gs-col-hash"><code>${escapeHtml(c.hash.slice(0, 7))}</code></div></td>
            </tr>
        `;
    }).join('');

    const rowDivider = isDark ? 'rgba(51,65,85,0.45)' : 'rgba(226,232,240,0.7)';

    const extraCss = `
        .gs-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            flex-wrap: wrap;
            gap: 8px 16px;
            margin-bottom: 12px;
        }
        .gs-title { font-size: 18px; font-weight: 700; margin: 0; }
        .gs-sub { font-size: 11.5px; color: var(--text-muted); display: flex; gap: 14px; flex-wrap: wrap; }
        .gs-frame {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 10px;
        }
        .gs-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: separate;
            border-spacing: 0;
        }
        .gs-table thead {
            display: table-header-group;
        }
        .gs-table thead th {
            height: 30px;
            padding: 0 8px 0 0;
            background: var(--surface-subtle);
            border-bottom: 1px solid var(--border);
            font-size: 11px;
            font-weight: 600;
            color: var(--text-muted);
            text-align: left;
            white-space: nowrap;
        }
        .gs-table thead th.gs-th-graph {
            padding-left: 10px;
            border-top-left-radius: 9px;
        }
        .gs-table thead th.gs-th-hash {
            text-align: right;
            padding-right: 10px;
            border-top-right-radius: 9px;
        }
        .gs-tr {
            height: ${rowHeight}px;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .gs-tr td {
            padding: 0;
            border: none;
            height: ${rowHeight}px;
            vertical-align: top;
        }
        .gs-td-graph {
            line-height: 0;
            font-size: 0;
            width: ${graphWidth}px;
        }
        .gs-cell {
            height: ${rowHeight}px;
            display: flex;
            align-items: center;
            overflow: hidden;
            font-size: 12px;
            line-height: 1.35;
            box-shadow: inset 0 -1px 0 ${rowDivider};
        }
        .gs-tr:last-child .gs-cell {
            box-shadow: none;
        }
        .gs-col-msg {
            min-width: 0;
            gap: 4px;
            padding-right: 10px;
        }
        .gs-msg-text {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .gs-stat { flex-shrink: 0; margin-left: 4px; display: inline-flex; gap: 4px; }
        .gs-col-author {
            color: var(--text-muted);
            padding-right: 8px;
            white-space: nowrap;
            text-overflow: ellipsis;
            display: block;
            line-height: ${rowHeight}px;
        }
        .gs-col-date {
            color: var(--text-muted);
            font-size: 11px;
            white-space: nowrap;
            padding-right: 8px;
        }
        .gs-col-hash {
            justify-content: flex-end;
            padding-right: 10px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 11px;
            color: var(--text-muted);
        }
        .gs-stats-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            padding: 8px 14px;
            background: var(--surface-subtle);
            border-top: 1px solid var(--border);
            border-bottom-left-radius: 9px;
            border-bottom-right-radius: 9px;
            font-size: 11.5px;
            color: var(--text-muted);
            break-inside: avoid;
        }
        @media print {
            .gs-frame {
                border: none;
                border-radius: 0;
            }
            .gs-table {
                border-left: 1px solid var(--border);
                border-right: 1px solid var(--border);
                border-bottom: 1px solid var(--border);
            }
            .gs-table thead th {
                border-top: 1px solid var(--border);
            }
            .gs-table thead th.gs-th-graph,
            .gs-table thead th.gs-th-hash {
                border-radius: 0;
            }
            .gs-stats-bar {
                border: 1px solid var(--border);
                border-top: none;
                border-radius: 0;
            }
        }
    `;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(ctx.repoName)} - ${escapeHtml($t('git.devLog.templateGraph'))}</title>
<style>${buildBaseStyles(isDark, 'graph')}${extraCss}</style>
</head>
<body>
<div class="page">
    <header class="gs-header">
        <h1 class="gs-title">${escapeHtml(ctx.repoName)}</h1>
        <div class="gs-sub">
            <span>${escapeHtml($t('git.devLog.branchScope', { branch: ctx.branchLabel }))}</span>
            ${summary.dateSpan ? `<span>${escapeHtml(summary.dateSpan)}</span>` : ''}
            <span>${escapeHtml($t('git.devLog.generatedAt', { date: ctx.generatedAt }))}</span>
        </div>
    </header>
    ${commits.length === 0 ? `<div class="empty-state">${escapeHtml($t('git.devLog.noCommitsInRange'))}</div>` : `
        <div class="gs-frame">
            <table class="gs-table">
                <colgroup>
                    <col style="width:${graphWidth}px;" />
                    <col />
                    <col style="width:98px;" />
                    <col style="width:112px;" />
                    <col style="width:64px;" />
                </colgroup>
                <thead>
                    <tr>
                        <th class="gs-th-graph">${escapeHtml($t('git.graph'))}</th>
                        <th>${escapeHtml($t('git.message'))}</th>
                        <th>${escapeHtml($t('git.author'))}</th>
                        <th>${escapeHtml($t('git.date'))}</th>
                        <th class="gs-th-hash">${escapeHtml($t('git.hash'))}</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
            ${ctx.options.includeStats ? `
                <div class="gs-stats-bar">
                    <span>${escapeHtml($t('git.devLog.statCommits'))}: <strong>${summary.commitCount}</strong></span>
                    <span>${escapeHtml($t('git.devLog.statActiveDays'))}: <strong>${summary.activeDays}</strong></span>
                    <span>${escapeHtml($t('git.devLog.statAuthors'))}: <strong>${summary.authorCount}</strong></span>
                    ${summary.hasLineStats ? `<span>${escapeHtml($t('git.devLog.statChanges'))}: <span class="stat-add">+${summary.totalAdditions}</span> <span class="stat-del">-${summary.totalDeletions}</span></span>` : ''}
                </div>
            ` : ''}
        </div>
    `}
</div>
</body>
</html>`;
}

export function renderDevLogHtml(ctx: DevLogRenderContext): string {
    const summary = computeSummary(ctx.commits, ctx.stats);
    if (ctx.options.template === 'report') {
        return renderReportHtml(ctx, summary);
    }
    if (ctx.options.template === 'graph') {
        return renderGraphSnapshotHtml(ctx, summary);
    }
    return renderTimelineHtml(ctx, summary);
}

export function renderDevLogMarkdown(ctx: DevLogRenderContext): string {
    const summary = computeSummary(ctx.commits, ctx.stats);
    const lines: string[] = [
        `# ${ctx.repoName}`,
        '',
        `> ${$t('git.devLog.branchScope', { branch: ctx.branchLabel })}${summary.dateSpan ? ` · ${summary.dateSpan}` : ''} · ${$t('git.devLog.generatedAt', { date: ctx.generatedAt })}`,
        '',
    ];

    if (ctx.options.includeStats) {
        lines.push(
            `- **${$t('git.devLog.statCommits')}**: ${summary.commitCount}`,
            `- **${$t('git.devLog.statActiveDays')}**: ${summary.activeDays}`,
            `- **${$t('git.devLog.statAuthors')}**: ${summary.authorCount}`,
        );
        if (summary.hasLineStats) {
            lines.push(`- **${$t('git.devLog.statChanges')}**: +${summary.totalAdditions} / -${summary.totalDeletions}`);
        }
        lines.push('');
    }

    const formatItem = (c: GitCommit): void => {
        const stat = ctx.stats[c.hash];
        const statSuffix = ctx.options.includeFiles && stat && stat.filesChanged > 0
            ? ` (${$t('git.devLog.filesCount', { count: stat.filesChanged })}, +${stat.additions}/-${stat.deletions})`
            : '';
        lines.push(`- \`${c.hash.slice(0, 7)}\` ${c.message} — *${c.author}*, ${formatDateTimeShort(c.date)}${statSuffix}`);
        if (ctx.options.includeBody) {
            const body = extractCommitBody(stat, c.message);
            if (body) {
                for (const bLine of body.split('\n')) {
                    lines.push(`  > ${bLine}`);
                }
            }
        }
    };

    if (ctx.options.groupByType) {
        const groups = new Map<string, GitCommit[]>();
        for (const c of ctx.commits) {
            const cat = classifyCommit(c.message);
            const list = groups.get(cat.key);
            if (list) list.push(c);
            else groups.set(cat.key, [c]);
        }
        for (const meta of CATEGORY_ORDER) {
            const list = groups.get(meta.key);
            if (!list?.length) continue;
            lines.push(`## ${$t(meta.labelKey)} (${list.length})`, '');
            for (const c of list) formatItem(c);
            lines.push('');
        }
    } else {
        const dayGroups = new Map<string, GitCommit[]>();
        for (const c of ctx.commits) {
            const day = formatDateYmd(c.date);
            const list = dayGroups.get(day);
            if (list) list.push(c);
            else dayGroups.set(day, [c]);
        }
        for (const [day, list] of dayGroups.entries()) {
            lines.push(`## ${day} (${list.length})`, '');
            for (const c of list) formatItem(c);
            lines.push('');
        }
    }

    return lines.join('\n');
}
