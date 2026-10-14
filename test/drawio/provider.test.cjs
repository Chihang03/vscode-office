const{test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path');const{build}=require('esbuild');
const xml='<mxfile><diagram name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
const png=Uint8Array.from([137,80,78,71,13,10,26,10,...new TextEncoder().encode('mock-data-mxfile-chunk')]);
async function setup(opts={}){
 const state={text:xml,version:1,messages:[],edits:0,saves:0,readOnly:false,listeners:[],disk:png,writes:[],events:[],commands:{},errors:[],picks:0,...opts};
 const output=await build({entryPoints:[path.resolve(__dirname,'../../src/drawio/provider.ts')],bundle:true,format:'cjs',platform:'node',write:false,plugins:[{name:'mock',setup(b){b.onResolve({filter:/^(vscode|\.\/webview)$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='./webview'?'export const diagramHtml=async()=>"<html>test</html>";':`
 export const Uri={joinPath:(uri,...parts)=>({path:parts.at(-1),scheme:'file',toString:()=>parts.at(-1)}),parse:value=>({path:value,toString:()=>value})};
 export const FilePermission={Readonly:1}; export class Range {constructor(start,end){this.start=start;this.end=end}};
 export class WorkspaceEdit {replace(uri,range,text){this.text=text;this.uri=uri}};
 export class EventEmitter {event=()=>{};fire(event){state.events.push(event)}dispose(){}};
 export class CancellationError extends Error{};
 export const workspace={fs:{createDirectory:async()=>{},isWritableFileSystem:()=>!state.readOnly,stat:async()=>{if(state.statError)throw state.statError;if(state.exists===false)throw{code:'FileNotFound'};return{permissions:state.readOnly?1:0}},readFile:async()=>state.disk,writeFile:async(uri,bytes)=>{state.writes.push(bytes);state.disk=bytes},delete:async()=>{}},
 onDidChangeTextDocument:fn=>{state.listeners.push(fn);return{dispose(){}}},applyEdit:async edit=>{state.edits++;if(state.reject)return false;state.text=edit.text;state.version++;state.listeners.forEach(fn=>fn({document:state.document}));return true},createFileSystemWatcher:()=>({onDidChange(){},dispose(){}})};
 export const window={activeTextEditor:state.activeUri?{document:{uri:state.activeUri}}:undefined,showOpenDialog:async()=>{state.picks++;return undefined},showErrorMessage:async message=>state.errors.push(message),registerCustomEditorProvider:()=>({dispose(){}}),showSaveDialog:async()=>state.target}; export const commands={registerCommand:(name,fn)=>{state.commands[name]=fn;return{dispose(){}}},executeCommand:async()=>{if(state.nativeSave)await state.nativeSave()}};
 export class RelativePattern{constructor(){}};`,loader:'js'}));}}]});
 const context={module:{exports:{}},exports:{},state,require,TextEncoder,TextDecoder,Uint8Array,atob,console};vm.runInNewContext(output.outputFiles[0].text,context);
 const api=context.module.exports;const uri={scheme:state.readOnly?'git':'file',path:'/sample.drawio',toString:()=>'/sample.drawio'};
 const document={uri,get version(){return state.version},getText:()=>state.text,positionAt:offset=>offset,save:async()=>{state.saves++;return !state.saveFails}};state.document=document;
 const panel={webview:{onDidReceiveMessage:fn=>{state.receive=fn;return{dispose(){}}},postMessage:async message=>{state.messages.push(message);return true}},onDidDispose:fn=>{state.close=fn}};
 const extension={subscriptions:[],extensionUri:{path:'/extension'}};
 return{state,api,uri,document,panel,extension};
}
async function wait(state){for(let i=0;i<40;i++){await new Promise(r=>setImmediate(r));if(state.messages.some(m=>m.type==='ack'||m.type==='error'||m.type==='document'))return;}throw Error('No response');}
test('Text editing updates VS Code buffer without autosaving disk; Save explicitly saves',async()=>{
 const h=await setup();await new h.api.DiagramTextProvider(h.extension).resolveCustomTextEditor(h.document,h.panel);h.state.receive({type:'change',content:xml.replace('Page-1','Changed'),version:1,id:1});await wait(h.state);assert.equal(h.state.edits,1);assert.equal(h.state.saves,0);assert.equal(h.state.messages.at(-1).version,2);h.state.messages=[];h.state.receive({type:'change',content:h.state.text,version:2,id:2,save:true});await wait(h.state);assert.equal(h.state.saves,1);assert.equal(h.state.edits,1);
});
test('Stale versions and read-only sources never overwrite document buffers',async()=>{
 for(const opts of [{},{readOnly:true}]){const h=await setup(opts);await new h.api.DiagramTextProvider(h.extension).resolveCustomTextEditor(h.document,h.panel);h.state.receive({type:'change',content:xml.replace('Page-1','Changed'),version:0,id:1});await wait(h.state);assert.equal(h.state.edits,0);assert.equal(h.state.messages.at(-1).type,'error');}
});
test('Rejected edits and malformed exports leave the original buffer unchanged',async()=>{
 for(const opts of [{reject:true},{}]){const h=await setup(opts);await new h.api.DiagramTextProvider(h.extension).resolveCustomTextEditor(h.document,h.panel);h.state.receive({type:'change',content:opts.reject?xml.replace('Page-1','Changed'):'garbage',version:1,id:1});await wait(h.state);assert.equal(h.state.text,xml);assert.equal(h.state.messages.at(-1).type,'error');}
});
test('External text updates are published and disposed panels ignore late messages',async()=>{
 const h=await setup();await new h.api.DiagramTextProvider(h.extension).resolveCustomTextEditor(h.document,h.panel);h.state.listeners[0]({document:h.document});await wait(h.state);assert.equal(h.state.messages.at(-1).type,'document');h.state.close();h.state.receive({type:'change',content:xml,version:1,id:1});await new Promise(r=>setImmediate(r));assert.equal(h.state.edits,0);
});
test('PNG changes are undoable; Save uses native command and preserves embedded data',async()=>{
 const h=await setup();const provider=new h.api.DiagramPngProvider(h.extension);const document=await provider.openCustomDocument(h.uri,{});await provider.resolveCustomEditor(document,h.panel);
 const next=Uint8Array.from([...png,1]);h.state.nativeSave=()=>provider.saveCustomDocument(document,{isCancellationRequested:false});h.state.receive({type:'change',version:1,id:1,content:'data:image/png;base64,'+Buffer.from(next).toString('base64'),save:true});await wait(h.state);assert.equal(h.state.events.length,1);assert.deepEqual(Array.from(h.state.disk),Array.from(next));await h.state.events[0].undo();assert.deepEqual(Array.from(document.bytes),Array.from(png));await h.state.events[0].redo();assert.deepEqual(Array.from(document.bytes),Array.from(next));
});
test('PNG disk conflict and cancelled save never overwrite external data',async()=>{
 const h=await setup();const provider=new h.api.DiagramPngProvider(h.extension);const document=await provider.openCustomDocument(h.uri,{});h.state.disk=new Uint8Array([99]);await assert.rejects(provider.saveCustomDocument(document,{isCancellationRequested:false}),/changed on disk/);assert.equal(h.state.writes.length,0);await assert.rejects(provider.saveCustomDocument(document,{isCancellationRequested:true}));assert.equal(h.state.writes.length,0);
});
test('PNG backup restores dirty content and revert reads source bytes',async()=>{
 const h=await setup();const provider=new h.api.DiagramPngProvider(h.extension);const document=await provider.openCustomDocument(h.uri,{});const backup=await provider.backupCustomDocument(document,{destination:h.uri},{isCancellationRequested:false});assert.equal(backup.id,h.uri.toString());await provider.revertCustomDocument(document);assert.deepEqual(Array.from(document.bytes),Array.from(png));
});

test('Open Diagram picks a file rather than treating an active Markdown buffer as a diagram',async()=>{
 const h=await setup({activeUri:{path:'/notes.md'}});h.api.registerDiagrams(h.extension);await h.state.commands['kieranDocumentStudio.drawio.open']();assert.equal(h.state.picks,1);assert.equal(h.state.writes.length,0);
});
test('New Diagram never truncates an existing file or ignores a filesystem permission failure',async()=>{
 for(const options of [{},{statError:{code:'NoPermissions'}}]){const h=await setup({...options,target:{path:'/existing.drawio'}});h.api.registerDiagrams(h.extension);const call=h.state.commands['kieranDocumentStudio.drawio.new'];if(options.statError)await assert.rejects(call());else await call();assert.equal(h.state.writes.length,0);}
});
test('New Diagram does not initialize a binary image as an XML text document',async()=>{
 const h=await setup({target:{path:'/diagram.drawio.png'}});h.api.registerDiagrams(h.extension);await h.state.commands['kieranDocumentStudio.drawio.new']();assert.equal(h.state.writes.length,0);assert.equal(h.state.errors.length,1);
});
