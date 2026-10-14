import * as vscode from 'vscode';
import { extensionResource, readExtensionText } from '../common/extensionResource';
export async function diagramHtml(context: vscode.ExtensionContext, webview: vscode.Webview) {
    webview.options = { enableScripts: true, localResourceRoots: [context.extensionUri] };
    const engine = webview.asWebviewUri(extensionResource(context, 'resource', 'drawio', 'index.html')).toString();
    const bridge = webview.asWebviewUri(extensionResource(context, 'resource', 'drawio-host', 'bridge.js')).toString();
    const css = webview.asWebviewUri(extensionResource(context, 'resource', 'drawio-host', 'style.css')).toString();
    const nonce = Array.from({length:32},()=>Math.floor(Math.random()*36).toString(36)).join('');
    const language = vscode.env.language.toLowerCase();
    const editorHtml = await readExtensionText(context, 'resource', 'drawio', 'index.html');
    const config = JSON.stringify({ engine, editorHtml, language, source: webview.cspSource }).replace(/</g, '\\u003c');
    return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline'; connect-src ${webview.cspSource}; font-src ${webview.cspSource} data:; worker-src ${webview.cspSource} blob:; frame-src ${webview.cspSource} 'self' blob:; img-src ${webview.cspSource} data:; base-uri ${webview.cspSource};"><title>Kieran Document Studio</title><link rel="stylesheet" href="${css}"></head><body><header><strong>Kieran Document Studio</strong><span id="filename"></span><span class="controls"><button id="save"></button><button id="export-svg"></button><button id="export-png"></button><button id="fit"></button></span></header><div id="message" role="status"></div><button id="reload" hidden></button><iframe id="diagram" title="Diagram editor" sandbox="allow-scripts allow-same-origin allow-downloads" allow="clipboard-read; clipboard-write"></iframe><script nonce="${nonce}" id="studio-config" type="application/json">${config}</script><script nonce="${nonce}" type="module" src="${bridge}"></script></body></html>`;
}
