import * as vscode from 'vscode';
import { Global } from './common/global';
import { TelemetryService } from './service/telemetryService';
import { JavaDecompilerProvider } from './provider/javaDecompilerProvider';
import { MarkdownEditorProvider } from './provider/markdownEditorProvider';
import { OfficeViewerProvider } from './provider/officeViewerProvider';
import { ArchiveViewerProvider } from './provider/archiveViewerProvider';
import { ClassViewerProvider } from './provider/classViewerProvider';
import { HtmlService } from './service/htmlService';
import { MarkdownService } from './service/markdownService';
import { switchCsvEditor } from './service/csvService';
import { FileUtil } from './common/fileUtil';
import { ReactApp } from './common/reactApp';
import { activateHttp } from './provider/http';
import { activateYaml } from './provider/yaml';
import { activateXml } from './provider/xml';
import { activateGitHistory } from './gitHistory/provider';
import { IconService } from './service/icon/iconService';

export async function activate(context: vscode.ExtensionContext) {
	await Global.init(context);
	TelemetryService.init(context);
	await IconService.getInstance().init(context);
	activateHttp(context);
	activateYaml(context);
	activateXml(context);
	activateGitHistory(context);
	const viewOption = { webviewOptions: { retainContextWhenHidden: true } };
	FileUtil.init(context)
	ReactApp.init(context)
	const markdownService = new MarkdownService(context);
	const viewerInstance = new OfficeViewerProvider(context);
	const archiveViewerInstance = new ArchiveViewerProvider(context);
	const classViewerInstance = new ClassViewerProvider(context);
	const markdownEditorProvider = new MarkdownEditorProvider(context)
	context.subscriptions.push(
		vscode.commands.registerCommand('kieranDocumentStudio.markdown.switch', (uri) => { markdownService.switchEditor(uri) }),
		vscode.commands.registerCommand('kieranDocumentStudio.markdown.exportPdf', (uri) => markdownService.exportMarkdown(uri, { type: 'pdf' })),
		vscode.commands.registerCommand('kieranDocumentStudio.csv.switch', (uri) => { switchCsvEditor(uri) }),
		vscode.commands.registerCommand('kieranDocumentStudio.markdown.paste', () => { markdownService.loadClipboardImage() }),
		vscode.commands.registerCommand('kieranDocumentStudio.html.preview', uri => HtmlService.previewHtml(uri, context)),
		vscode.workspace.registerTextDocumentContentProvider('kieran-document-studio-java', new JavaDecompilerProvider(context)),
		vscode.window.registerCustomEditorProvider("kieranDocumentStudio.markdownViewer", markdownEditorProvider, viewOption),
		vscode.window.registerCustomEditorProvider("kieranDocumentStudio.markdownPreview", markdownEditorProvider, viewOption),
		archiveViewerInstance.bindCustomEditor(viewOption),
		classViewerInstance.bindCustomEditor(viewOption),
		...viewerInstance.bindCustomEditors(viewOption)
	);
}

export function deactivate() { }
