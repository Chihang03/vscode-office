import { basename, extname } from 'path';
import * as vscode from 'vscode';
import { parseAudioAnalysisSettings } from '@/common/audioAnalysisSettings';
import { Handler } from '@/common/handler';
import { bytesToPayloadBuffer, readUriBytes } from './officeContent';

const AUDIO_MIME: Record<string, string> = {
    '.wav': 'audio/wav', '.wave': 'audio/wav', '.mp3': 'audio/mpeg',
    '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
    '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.aif': 'audio/aiff', '.aiff': 'audio/aiff',
    '.webm': 'audio/webm',
};
const ANALYSIS_SETTINGS_KEY = 'kieranDocumentStudio.audioAnalysisSettings';
let analysisSettingsUpdates = Promise.resolve();
const POSITION_KEY = 'kieranDocumentStudio.audioPositions';
const VIRTUAL_AUDIO_LIMIT = 16 * 1024 * 1024;
let positionUpdates = Promise.resolve();

export function isAudio(fileName: string) {
    return Object.prototype.hasOwnProperty.call(AUDIO_MIME, fileName.startsWith('.') && !fileName.includes('/') ? fileName.toLowerCase() : extname(fileName).toLowerCase());
}

export function handleAudio(handler: Handler, uri: vscode.Uri, webview: vscode.Webview, context: vscode.ExtensionContext) {
    let requestId = 0;
    const id = uri.toString();
    const send = async () => {
        const request = ++requestId;
        try {
            const stat = await vscode.workspace.fs.stat(uri).catch(() => undefined);
            await analysisSettingsUpdates.catch(() => {});
            const positions = context.workspaceState.get<Record<string, { time: number; updated: number }>>(POSITION_KEY, {});
            const payload: Record<string, unknown> = {
                id, fileName: basename(uri.fsPath), ext: extname(uri.fsPath).toLowerCase(),
                mime: AUDIO_MIME[extname(uri.fsPath).toLowerCase()], size: stat?.size,
                version: `${id}:${stat?.mtime ?? 0}:${stat?.size ?? 0}`,
                resumeTime: positions[id]?.time ?? 0,
                analysisSettings: parseAudioAnalysisSettings(context.globalState.get(ANALYSIS_SETTINGS_KEY)),
            };
            if (uri.scheme === 'file') {
                payload.src = webview.asWebviewUri(uri).with({ query: `version=${stat?.mtime ?? Date.now()}` }).toString();
            } else {
                if (stat && stat.size > VIRTUAL_AUDIO_LIMIT) throw new Error('Virtual audio preview is limited to 16 MiB. Open a local copy for larger files.');
                const bytes = await readUriBytes(uri);
                if (bytes.length > VIRTUAL_AUDIO_LIMIT) throw new Error('Virtual audio preview is limited to 16 MiB.');
                payload.size = bytes.length;
                payload.buffer = bytesToPayloadBuffer(bytes);
            }
            if (request === requestId) handler.emit('audio', payload);
        } catch (error) {
            if (request === requestId) handler.emit('audio', { id, fileName: basename(uri.fsPath), error: error instanceof Error ? error.message : 'Unable to read audio' });
        }
    };
    handler.on('audioInit', send).on('fileChange', send);
    handler.on('audioAnalysisSettings', (payload: unknown) => {
        const settings = parseAudioAnalysisSettings(payload);
        if (!settings) return;
        analysisSettingsUpdates = analysisSettingsUpdates.catch(() => {}).then(() => context.globalState.update(ANALYSIS_SETTINGS_KEY, settings));
        return analysisSettingsUpdates;
    });
    handler.on('audioPosition', (payload: { time?: number }) => {
        if (!Number.isFinite(payload?.time) || payload.time! < 0 || payload.time! > 7 * 24 * 3600) return;
        const time = payload.time!;
        positionUpdates = positionUpdates.catch(() => {}).then(async () => {
            const positions = { ...context.workspaceState.get<Record<string, { time: number; updated: number }>>(POSITION_KEY, {}) };
            positions[id] = { time, updated: Date.now() };
            const retained = Object.fromEntries(Object.entries(positions).sort((a, b) => b[1].updated - a[1].updated).slice(0, 200));
            await context.workspaceState.update(POSITION_KEY, retained);
        });
        return positionUpdates;
    });
    handler.on('dispose', () => { requestId++; });
    handler.on('developerTool', () => vscode.commands.executeCommand('workbench.action.toggleDevTools'));
}
