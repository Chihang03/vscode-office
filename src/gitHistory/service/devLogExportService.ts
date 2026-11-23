import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import chromeFinder from 'chrome-finder';
import * as vscode from 'vscode';
import { Global, i18n } from '@/common/global';
import type { GitExecutor } from './gitExecutor';

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

export type DevLogExportFormat = 'png' | 'pdf' | 'markdown';

export interface ExportDevLogPayload {
    repo: string;
    format: DevLogExportFormat;
    suggestedFileName: string;
    content: string;
    viewportWidth?: number;
    headerTitle?: string;
    footerDate?: string;
}

export interface ExportDevLogResult {
    savedPath: string | null;
    error: string | null;
    cancelled?: boolean;
}

const COMMIT_MARKER = '<<<KDS_DEVLOG_COMMIT>>>';
const FIELD_SEP = '<<<KDS_DEVLOG_FIELD>>>';
const BODY_END = '<<<KDS_DEVLOG_BODY_END>>>';
const BATCH_SIZE = 80;

const CHROMIUM_PATHS: string[] = [
    // Windows
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge Beta\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge Dev\\Application\\msedge.exe',
    path.join(os.homedir(), 'AppData\\Local\\Microsoft\\Edge SxS\\Application\\msedge.exe'),
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
];

function findChromiumExecutable(): string {
    const configured = Global.getConfig<string>('chromiumPath');
    const candidates = [configured, ...CHROMIUM_PATHS];
    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }
    try {
        return chromeFinder();
    } catch {
        throw new Error(i18n('ext.git.devLogNoChromium'));
    }
}

function escapeHeaderHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function parseCommitStatsOutput(stdout: string): Record<string, DevLogCommitStat> {
    const result: Record<string, DevLogCommitStat> = {};
    const blocks = stdout.split(COMMIT_MARKER);
    for (const rawBlock of blocks) {
        const block = rawBlock.trim();
        if (!block) continue;

        const fieldIdx = block.indexOf(FIELD_SEP);
        if (fieldIdx < 0) continue;

        const hash = block.slice(0, fieldIdx).trim();
        const rest = block.slice(fieldIdx + FIELD_SEP.length);
        const bodyEndIdx = rest.indexOf(BODY_END);
        if (bodyEndIdx < 0) continue;

        const body = rest.slice(0, bodyEndIdx).trim();
        const numstatSection = rest.slice(bodyEndIdx + BODY_END.length);

        const files: DevLogFileStat[] = [];
        let totalAdd = 0;
        let totalDel = 0;

        for (const line of numstatSection.split(/\r?\n/)) {
            if (!line.trim()) continue;
            const parts = line.split('\t');
            if (parts.length < 3) continue;
            const add = parts[0] === '-' ? 0 : (parseInt(parts[0], 10) || 0);
            const del = parts[1] === '-' ? 0 : (parseInt(parts[1], 10) || 0);
            const filePath = parts.slice(2).join('\t').trim();
            totalAdd += add;
            totalDel += del;
            files.push({ path: filePath, additions: add, deletions: del });
        }

        result[hash] = {
            body,
            additions: totalAdd,
            deletions: totalDel,
            filesChanged: files.length,
            files,
        };
    }
    return result;
}

export class DevLogExportService {
    constructor(private readonly executor: GitExecutor) { }

    async loadCommitStats(repo: string, hashes: ReadonlyArray<string>): Promise<Record<string, DevLogCommitStat>> {
        const validHashes = hashes.filter((h) => h && h !== '*');
        if (validHashes.length === 0) {
            return {};
        }

        const combined: Record<string, DevLogCommitStat> = {};
        const format = `${COMMIT_MARKER}%H${FIELD_SEP}%B${BODY_END}`;

        for (let i = 0; i < validHashes.length; i += BATCH_SIZE) {
            const batch = validHashes.slice(i, i + BATCH_SIZE);
            try {
                const parsed = await this.executor.spawn(
                    ['log', '--no-walk=unsorted', '--numstat', `--format=${format}`, ...batch],
                    repo,
                    parseCommitStatsOutput,
                );
                Object.assign(combined, parsed);
            } catch {
                // Continue with remaining batches if a single ref cannot be resolved
            }
        }
        return combined;
    }

    async exportDevLog(payload: ExportDevLogPayload): Promise<ExportDevLogResult> {
        const filters: Record<string, string[]> = payload.format === 'pdf'
            ? { PDF: ['pdf'] }
            : payload.format === 'png'
                ? { PNG: ['png'] }
                : { Markdown: ['md'] };

        const defaultDir = payload.repo && fs.existsSync(payload.repo) ? payload.repo : os.homedir();
        const defaultUri = vscode.Uri.file(path.join(defaultDir, payload.suggestedFileName));

        const targetUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters,
            saveLabel: i18n('ext.git.devLogSaveLabel'),
        });

        if (!targetUri) {
            return { savedPath: null, error: null, cancelled: true };
        }

        const targetPath = targetUri.fsPath;

        if (payload.format === 'markdown') {
            try {
                fs.writeFileSync(targetPath, payload.content, 'utf-8');
                void this.notifySuccess(targetUri);
                return { savedPath: targetPath, error: null };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                return { savedPath: null, error: msg };
            }
        }

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kds-git-devlog-'));
        const tmpHtmlPath = path.join(tmpDir, 'devlog.html');
        let browser: { close: () => Promise<void> } | undefined;

        try {
            const executablePath = findChromiumExecutable();
            fs.writeFileSync(tmpHtmlPath, payload.content, 'utf-8');

            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const puppeteer = require('puppeteer-core');
            const puppeteerArgs = process.platform === 'linux'
                ? ['--allow-file-access-from-files', '--no-sandbox', '--disable-setuid-sandbox']
                : ['--allow-file-access-from-files'];

            browser = await puppeteer.launch({
                headless: true,
                executablePath,
                args: puppeteerArgs,
            });

            const page = await (browser as any).newPage();
            const viewportWidth = payload.viewportWidth ?? 960;
            await page.setViewport({
                width: viewportWidth,
                height: 800,
                deviceScaleFactor: payload.format === 'png' ? 2 : 1,
            });

            await page.goto(pathToFileURL(tmpHtmlPath).href, {
                waitUntil: 'load',
                timeout: 60000,
            });

            await page.evaluate('document.fonts && document.fonts.ready');

            if (payload.format === 'png') {
                await page.screenshot({
                    path: targetPath,
                    type: 'png',
                    fullPage: true,
                });
            } else {
                const safeTitle = escapeHeaderHtml(payload.headerTitle || i18n('ext.git.panelTitle'));
                const safeDate = escapeHeaderHtml(payload.footerDate || '');
                const headerTemplate = `<div style="width:100%;font-size:8px;color:#6b7280;padding:0 12mm;display:flex;justify-content:space-between;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><span>${safeTitle}</span><span></span></div>`;
                const footerTemplate = `<div style="width:100%;font-size:8px;color:#6b7280;padding:0 12mm;display:flex;justify-content:space-between;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><span>${safeDate}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;

                const pdfBytes = await page.pdf({
                    format: 'A4',
                    printBackground: true,
                    displayHeaderFooter: true,
                    headerTemplate,
                    footerTemplate,
                    margin: {
                        top: '15mm',
                        bottom: '15mm',
                        left: '10mm',
                        right: '10mm',
                    },
                });
                fs.writeFileSync(targetPath, pdfBytes);
            }

            void this.notifySuccess(targetUri);
            return { savedPath: targetPath, error: null };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { savedPath: null, error: msg };
        } finally {
            try {
                if (browser) {
                    await browser.close();
                }
            } finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        }
    }

    private async notifySuccess(uri: vscode.Uri): Promise<void> {
        const openBtn = i18n('ext.git.devLogOpenFile');
        const choice = await vscode.window.showInformationMessage(
            i18n('ext.git.devLogExportSuccess', path.basename(uri.fsPath)),
            openBtn,
        );
        if (choice === openBtn) {
            await vscode.commands.executeCommand('vscode.open', uri);
        }
    }
}
