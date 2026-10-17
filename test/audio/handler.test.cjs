const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const path=require('node:path');const {build}=require('esbuild');
async function setup(overrides={}) {
 const state={messages:[],read:0,data:new Uint8Array([1,2]),stat:{mtime:5,size:2},positions:{},analysisSettings:undefined,...overrides};
 const result=await build({entryPoints:[path.resolve(__dirname,'../../src/provider/handlers/audioHandler.ts')],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'mock',setup(b){
  b.onResolve({filter:/^(vscode|\.\/officeContent)$/},a=>({path:a.path,namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='vscode'?`export const workspace={fs:{stat:async()=>state.stat}}; export const commands={executeCommand(){}};`:`export const readUriBytes=async()=>{state.read++;return state.data};export const bytesToPayloadBuffer=bytes=>Array.from(bytes);`,loader:'js'}));
 }}]});
 const context={module:{exports:{}},exports:{},require,state};vm.runInNewContext(result.outputFiles[0].text,context);
 const callbacks={};const handler={on(type,fn){callbacks[type]=fn;return this;},emit(type,content){state.messages.push({type,content});return this;}};
 const uri={scheme:state.scheme||'file',fsPath:'/audio/TEST.WAV',toString:()=>`${state.scheme||'file'}:///audio/TEST.WAV`};
 const webview={asWebviewUri(){return {with({query}){return {toString:()=>`https://local/TEST.WAV?${query}`};}};}};
 const ext={globalState:{get:()=>state.analysisSettings,update:async(key,value)=>{state.analysisSettings=value;}},workspaceState:{get:()=>state.positions,update:async(key,value)=>{state.positions=value;}}};
 context.module.exports.handleAudio(handler,uri,webview,ext);
 return {state,callbacks,isAudio:context.module.exports.isAudio};
}
test('Audio route accepts suffixes and uppercase filenames; source is a webview URL',async()=>{
 const {state,callbacks,isAudio}=await setup();assert.ok(isAudio('.wav'));assert.ok(isAudio('/audio/TEST.WAV'));assert.ok(isAudio('.M4A'));assert.equal(isAudio('file.txt'),false);await callbacks.audioInit();const data=state.messages[0].content;assert.equal(data.ext,'.wav');assert.equal(data.mime,'audio/wav');assert.equal(data.src,'https://local/TEST.WAV?version=5');assert.equal(state.read,0);assert.equal(callbacks.save,undefined);assert.equal(callbacks.write,undefined);
});
test('Virtual audio buffers are capped and source position survives reopening',async()=>{
 const {state,callbacks}=await setup({scheme:'git'});await callbacks.audioPosition({time:2.25});await callbacks.audioInit();assert.equal(state.messages[0].content.resumeTime,2.25);assert.deepEqual(Array.from(state.messages[0].content.buffer),[1,2]);await callbacks.audioPosition({time:NaN});await callbacks.audioPosition({time:-3});assert.equal(Object.values(state.positions)[0].time,2.25);
 const large=await setup({scheme:'git',stat:{mtime:1,size:17*1024*1024}});await large.callbacks.audioInit();assert.match(large.state.messages[0].content.error,/16 MiB/);assert.equal(large.state.read,0);
});
test('Disposed or superseded async requests never publish stale payloads',async()=>{
 const {state,callbacks}=await setup();const first=callbacks.audioInit();const second=callbacks.fileChange();await Promise.all([first,second]);assert.equal(state.messages.length,1);const pending=callbacks.audioInit();callbacks.dispose();await pending;assert.equal(state.messages.length,1);
});

test('Analysis preferences survive a new viewer; invalid payloads do not replace valid settings',async()=>{
 const first=await setup();const settings={channel:'both',fftSize:65536,minFrequency:900,maxFrequency:1100,logarithmic:true,markers:'37, 47'};
 await first.callbacks.audioAnalysisSettings({...settings,expanded:true,spectrum:[1,2,3]});
 assert.equal(first.state.analysisSettings.fftSize,65536);assert.equal(first.state.analysisSettings.expanded,undefined);assert.equal(first.state.analysisSettings.spectrum,undefined);
 const reopened=await setup({analysisSettings:first.state.analysisSettings});await reopened.callbacks.audioInit();assert.equal(reopened.state.messages[0].content.analysisSettings.markers,'37, 47');
 await reopened.callbacks.audioAnalysisSettings({...settings,fftSize:100});await reopened.callbacks.audioAnalysisSettings({...settings,minFrequency:2000});await reopened.callbacks.audioAnalysisSettings({...settings,markers:'x'.repeat(129)});
 assert.equal(reopened.state.analysisSettings.fftSize,65536);assert.equal(reopened.state.analysisSettings.minFrequency,900);
 const broken=await setup({analysisSettings:{channel:'both'}});await broken.callbacks.audioInit();assert.equal(broken.state.messages[0].content.analysisSettings,undefined);
});
