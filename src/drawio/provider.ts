import * as vscode from 'vscode';
import { diagramFormat, isDiagramPath, decodeDataUri, sameBytes, validatePng, validateText } from './formats';
import { diagramHtml } from './webview';

async function readonly(uri: vscode.Uri) {
    if (uri.scheme === 'git' || vscode.workspace.fs.isWritableFileSystem(uri.scheme) === false) return true;
    try { const stat = await vscode.workspace.fs.stat(uri); return !!(stat.permissions && stat.permissions & vscode.FilePermission.Readonly); } catch { return false; }
}
async function exportFile(source: vscode.Uri, payload: { format: string; data: string }) {
    if (!['svg','png'].includes(payload.format)) throw new Error('Unsupported export format');
    const bytes = payload.format === 'png' ? decodeDataUri(payload.data, 'image/png') : new TextEncoder().encode(payload.data);
    if (payload.format === 'png') validatePng(bytes); else validateText(payload.data, 'svg');
    const name = source.path.split('/').pop()!.replace(/\.(?:drawio|dio)(?:\.(?:svg|png))?$/i, '');
    const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.joinPath(source, '..', `${name}.drawio.${payload.format}`), filters: { [payload.format.toUpperCase()]: [payload.format] } });
    if (target) { if(target.toString()===source.toString())throw new Error('Use Save to update the open diagram; choose a different export file.'); await vscode.workspace.fs.writeFile(target, bytes); }
}

export class DiagramTextProvider implements vscode.CustomTextEditorProvider {
    constructor(private context: vscode.ExtensionContext) {}
    async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel) {
        const format = diagramFormat(document.uri.path), webview = panel.webview;
        let closed = false, applying = false; let queue = Promise.resolve();
        const send = async () => { if (!closed) await webview.postMessage({ type:'document', content:document.getText(), version:document.version, format, name:document.uri.path.split('/').pop(), readOnly:await readonly(document.uri) }); };
        const listener = vscode.workspace.onDidChangeTextDocument(event => { if (event.document.uri.toString()===document.uri.toString() && !applying) void send(); });
        const messages = webview.onDidReceiveMessage(message => {
            queue = queue.catch(()=>{}).then(async()=>{
                if (closed) return;
                try {
                    if (message.type==='init' || message.type==='reload') { await send(); return; }
                    if (message.type==='export') { await exportFile(document.uri,message); return; }
                    if (message.type!=='change') return;
                    if (await readonly(document.uri)) throw new Error('This diagram is read-only');
                    validateText(message.content,format);
                    if (message.version!==document.version) throw new Error('Document changed in another editor. Reload before continuing.');
                    if (message.content!==document.getText()) {
                        const edit=new vscode.WorkspaceEdit(); edit.replace(document.uri,new vscode.Range(document.positionAt(0),document.positionAt(document.getText().length)),message.content);
                        applying=true; let ok: boolean;
                        try { ok=await vscode.workspace.applyEdit(edit); } finally { applying=false; }
                        if (!ok) throw new Error('VS Code rejected the diagram edit');
                    }
                    if (message.save && !await document.save()) throw new Error('Unable to save diagram');
                    await webview.postMessage({type:'ack',id:message.id,version:document.version});
                } catch(error) { await webview.postMessage({type:'error',id:message.id,message:error instanceof Error?error.message:String(error)}); }
            });
        });
        panel.onDidDispose(()=>{closed=true;listener.dispose();messages.dispose();});
        webview.html=await diagramHtml(this.context,webview);
    }
}
export class PngDiagram implements vscode.CustomDocument {
    version=1;
    panels=new Set<vscode.WebviewPanel>();
    closed=false;
    constructor(public uri: vscode.Uri,public bytes: Uint8Array,public saved: Uint8Array) {}
    dispose(){this.closed=true;this.panels.clear();}
}
export class DiagramPngProvider implements vscode.CustomEditorProvider<PngDiagram> {
    private changes=new vscode.EventEmitter<vscode.CustomDocumentEditEvent<PngDiagram>>();
    onDidChangeCustomDocument=this.changes.event;
    constructor(private context: vscode.ExtensionContext){context.subscriptions.push(this.changes);}
    async openCustomDocument(uri: vscode.Uri,open: vscode.CustomDocumentOpenContext){
        const saved=await vscode.workspace.fs.readFile(uri);
        const bytes=open.backupId?await vscode.workspace.fs.readFile(vscode.Uri.parse(open.backupId)):saved;
        if(bytes.length) validatePng(bytes);
        return new PngDiagram(uri,bytes,saved);
    }
    private async send(document: PngDiagram){
        const message={type:'document',format:'png',content:Array.from(document.bytes),version:document.version,name:document.uri.path.split('/').pop(),readOnly:await readonly(document.uri)};
        await Promise.all([...document.panels].map(panel=>panel.webview.postMessage(message)));
    }
    async resolveCustomEditor(document: PngDiagram,panel: vscode.WebviewPanel){
        document.panels.add(panel);let queue=Promise.resolve();let closed=false;
        const listener=panel.webview.onDidReceiveMessage(message=>{
            queue=queue.catch(()=>{}).then(async()=>{
                if(closed) return;
                try{
                    if(message.type==='init'||message.type==='reload'){await this.send(document);return;}
                    if(message.type==='export'){await exportFile(document.uri,message);return;}
                    if(message.type!=='change')return;
                    if(await readonly(document.uri))throw new Error('This diagram is read-only');
                    if(message.version!==document.version)throw new Error('Document changed in another editor. Reload before continuing.');
                    const next=decodeDataUri(message.content,'image/png');validatePng(next);
                    if(!sameBytes(next,document.bytes)){
                        const previous=document.bytes;document.bytes=next;document.version++;
                        this.changes.fire({document,label:'Edit diagram',undo:async()=>{document.bytes=previous;document.version++;await this.send(document);},redo:async()=>{document.bytes=next;document.version++;await this.send(document);}});
                        // The sending panel keeps its canvas history; other panels reload the updated image.
                        const others=[...document.panels].filter(p=>p!==panel);
                        for(const other of others)await other.webview.postMessage({type:'document',format:'png',content:Array.from(next),version:document.version,name:document.uri.path.split('/').pop(),readOnly:false});
                    }
                    if(message.save){ await vscode.commands.executeCommand('workbench.action.files.save'); if(!sameBytes(document.saved,document.bytes))throw new Error('Unable to save diagram'); }
                    await panel.webview.postMessage({type:'ack',id:message.id,version:document.version});
                }catch(error){await panel.webview.postMessage({type:'error',id:message.id,message:error instanceof Error?error.message:String(error)});}
            });
        });
        const watcher=vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.joinPath(document.uri,'..'),document.uri.path.split('/').pop()!));
        watcher.onDidChange(async()=>{
            try{const bytes=await vscode.workspace.fs.readFile(document.uri);if(sameBytes(bytes,document.saved))return;
                if(!sameBytes(document.bytes,document.saved)){for(const p of document.panels)void p.webview.postMessage({type:'error',message:'File changed on disk. Use VS Code Revert File or Save As to resolve.'});return;}
                validatePng(bytes);document.bytes=bytes;document.saved=bytes;document.version++;await this.send(document);
            }catch{/* Deleted or transiently unavailable files must not erase the current diagram. */}
        });
        panel.onDidDispose(()=>{closed=true;document.panels.delete(panel);listener.dispose();watcher.dispose();});
        panel.webview.html=await diagramHtml(this.context,panel.webview);
    }
    async saveCustomDocument(document: PngDiagram,token: vscode.CancellationToken){
        if(token.isCancellationRequested)throw new vscode.CancellationError();
        if(await readonly(document.uri))throw new Error('This diagram is read-only');
        const disk=await vscode.workspace.fs.readFile(document.uri);
        if(!sameBytes(disk,document.saved))throw new Error('PNG changed on disk. Save a separate copy or revert first.');
        const snapshot=document.bytes;await vscode.workspace.fs.writeFile(document.uri,snapshot);document.saved=snapshot;
    }
    async saveCustomDocumentAs(document:PngDiagram,target:vscode.Uri,token:vscode.CancellationToken){if(token.isCancellationRequested)throw new vscode.CancellationError();await vscode.workspace.fs.writeFile(target,document.bytes);}
    async revertCustomDocument(document:PngDiagram){const bytes=await vscode.workspace.fs.readFile(document.uri);if(bytes.length)validatePng(bytes);document.bytes=bytes;document.saved=bytes;document.version++;await this.send(document);}
    async backupCustomDocument(document:PngDiagram,context:vscode.CustomDocumentBackupContext,token:vscode.CancellationToken){
        if(token.isCancellationRequested)throw new vscode.CancellationError();await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(context.destination,'..'));await vscode.workspace.fs.writeFile(context.destination,document.bytes);
        return {id:context.destination.toString(),delete:()=>{void vscode.workspace.fs.delete(context.destination).then(()=>{},()=>{});}};
    }
}
export function registerDiagrams(context:vscode.ExtensionContext){
    const options={webviewOptions:{retainContextWhenHidden:true},supportsMultipleEditorsPerDocument:true};
    context.subscriptions.push(vscode.window.registerCustomEditorProvider('kieranDocumentStudio.drawioEditor',new DiagramTextProvider(context),options),vscode.window.registerCustomEditorProvider('kieranDocumentStudio.drawioPngEditor',new DiagramPngProvider(context),options),
        vscode.commands.registerCommand('kieranDocumentStudio.drawio.open',async(uri?:vscode.Uri)=>{
            const active=vscode.window.activeTextEditor?.document.uri;
            uri=uri??(active&&isDiagramPath(active.path)?active:undefined);
            if(!uri){const selected=await vscode.window.showOpenDialog({canSelectMany:false,filters:{'Diagram files':['drawio','dio','svg','png']}});uri=selected?.[0];}
            if(uri&&!isDiagramPath(uri.path)){await vscode.window.showErrorMessage('Select a .drawio, .dio, .drawio.svg or .drawio.png file.');return;}
            if(uri)await vscode.commands.executeCommand('vscode.openWith',uri,diagramFormat(uri.path)==='png'?'kieranDocumentStudio.drawioPngEditor':'kieranDocumentStudio.drawioEditor');
        }),
        vscode.commands.registerCommand('kieranDocumentStudio.drawio.new',async()=>{
            const uri=await vscode.window.showSaveDialog({filters:{'Draw.io diagram':['drawio']}});if(!uri)return;
            if(!/\.(?:drawio|dio)$/i.test(uri.path)){await vscode.window.showErrorMessage('Choose a .drawio or .dio filename.');return;}
            let exists=true;
            try{await vscode.workspace.fs.stat(uri);}catch(error){if(error.code!=='FileNotFound')throw error;exists=false;}
            if(exists){await vscode.window.showErrorMessage('This file already exists. Open it to edit, or choose a new filename.');return;}
            await vscode.workspace.fs.writeFile(uri,new TextEncoder().encode(''));await vscode.commands.executeCommand('vscode.openWith',uri,'kieranDocumentStudio.drawioEditor');
        }));
}
