// Run after npm run build. Uses the actual production webview and inline worker.
// Uses an existing Playwright runtime, without adding a dependency.
// Disable physical audio output so playback-clock checks do not depend on the host audio device.
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const http=require('node:http');const {execFileSync}=require('node:child_process');
const {chromium}=require(process.env.KIERAN_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..');const output=fs.mkdtempSync(path.join(os.tmpdir(),'studio-audio-'));const fixtures=path.join(output,'fixtures');fs.mkdirSync(fixtures);
const cases=[],errors=[],codecResults=[];
function generate(){
 const ffmpeg=process.env.KIERAN_FFMPEG||'/opt/homebrew/bin/ffmpeg';
 execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','aevalsrc=0.6*sin(2*PI*440*t)*(0.4+0.6*sin(2*PI*0.7*t)^2)|0.35*sin(2*PI*220*t)*(0.2+0.8*sin(2*PI*0.25*t)^2):s=22050:d=10','-c:a','pcm_s16le',path.join(fixtures,'stereo.wav')]);
 execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','aevalsrc=0.25*(1+0.8*cos(2*PI*37*t))*cos(2*PI*1000*t)|0.25*(1+0.8*cos(2*PI*47*t))*cos(2*PI*1000*t):s=48000:d=12','-c:a','pcm_s16le',path.join(fixtures,'assr.wav')]);
 for(const [name,codec] of [['sample.mp3','libmp3lame'],['sample.flac','flac'],['sample.ogg','vorbis'],['sample.m4a','aac'],['mono24.wav','pcm_s24le'],['float.wav','pcm_f32le']])execFileSync(ffmpeg,['-v','error','-i',path.join(fixtures,'stereo.wav'),...(name==='mono24.wav'?['-ac','1']:[]),'-c:a',codec,'-strict','-2',path.join(fixtures,name)]);
 execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','anullsrc=r=44100:cl=mono','-t','420','-c:a','pcm_s16le',path.join(fixtures,'long.wav')]);
 fs.writeFileSync(path.join(fixtures,'broken.wav'),fs.readFileSync(path.join(fixtures,'stereo.wav')).subarray(0,100));
}
async function main(){
 generate();const html=fs.readFileSync(path.join(root,'out/webview/index.html'),'utf8').replace('{{configs}}',JSON.stringify({route:'audio',language:process.env.KIERAN_AUDIO_LANGUAGE||'en',config:{}}));
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent((req.url||'/').split('?')[0]);
  if(name==='/favicon.ico'){res.writeHead(204).end();return;}
  if(name==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  const file=name.startsWith('/fixtures/')?path.join(fixtures,path.basename(name)):path.join(root,'out/webview',name);
  if(!fs.existsSync(file)){res.writeHead(404).end();return;}
  const stat=fs.statSync(file);const range=req.headers.range?.match(/bytes=(\d+)-(\d*)/);let start=0,end=stat.size-1;
  const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.wav':'audio/wav','.mp3':'audio/mpeg','.flac':'audio/flac','.ogg':'audio/ogg','.m4a':'audio/mp4'})[ext]||'application/octet-stream');res.setHeader('Accept-Ranges','bytes');
  if(range){start=Number(range[1]);end=range[2]?Math.min(end,Number(range[2])):end;res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1});}else res.setHeader('Content-Length',stat.size);
  fs.createReadStream(file,{start,end}).pipe(res);
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.KIERAN_AUDIO_CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-audio-output']});
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.addInitScript(()=>{
   const OriginalWorker=window.Worker;window.Worker=class extends OriginalWorker{postMessage(...args){if(args[0]?.options)window.analysisWorkerStarts=(window.analysisWorkerStarts||0)+1;return super.postMessage(...args);}constructor(...args){super(...args);this.addEventListener('message',event=>{if(event.data?.type==='ready'&&event.data.result?.spectrum)window.lastAudioAnalysis=event.data.result;});}};
   window.hostMessages=[];window.acquireVsCodeApi=()=>({postMessage(message){window.hostMessages.push(message);if(message.type==='audioAnalysisSettings')localStorage.setItem('test-analysis-settings',JSON.stringify(message.content));if(message.type==='audioPosition'&&window.currentResource){localStorage.setItem('test-position:'+window.currentResource.id,String(message.content.time));}if(message.type==='audioInit'){const name=new URLSearchParams(location.search).get('file')||'stereo.wav';const size=Number(new URLSearchParams(location.search).get('size'))||0;window.currentResource={id:name,version:name+':'+(new URLSearchParams(location.search).get('version')||'1'),fileName:name,ext:'.'+name.split('.').pop(),mime:'audio/'+(name.endsWith('.wav')?'wav':'mpeg'),size,analysisSettings:JSON.parse(localStorage.getItem('test-analysis-settings')||'null'),src:location.origin+'/fixtures/'+name,resumeTime:Number(localStorage.getItem('test-position:'+name))||0};setTimeout(()=>window.postMessage({type:'audio',content:window.currentResource},'*'),0);}},getState(){return{}},setState(){}});
  });
  async function open(name='stereo.wav',version='1'){
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/?file='+name+'&size='+fs.statSync(path.join(fixtures,name)).size+'&version='+version);
   assert.equal(await page.title(),'Kieran Document Studio');await page.locator('h1').waitFor();assert.equal(await page.locator('vite-error-overlay').count(),0);assert.equal(await page.locator('h1').textContent(),name);return page;
  }
  async function ready(page){await page.getByTestId('waveform').waitFor({timeout:25000});}
  if(process.env.KIERAN_AUDIO_ANALYSIS_ONLY){await require('./analysis.scenarios.cjs')({open,ready,cases,output});assert.deepEqual(errors,[]);const result={status:'passed',output,language:process.env.KIERAN_AUDIO_LANGUAGE||'en',cases,errors};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));return;}
  const page=await open();await ready(page);
  assert.ok((await page.locator('.audio-meta').innerText()).includes('22,050 Hz'));assert.ok((await page.locator('.audio-meta').innerText()).includes('16 bit'));
  assert.ok(await page.evaluate(()=>document.querySelector('audio').paused&&document.querySelector('audio').currentTime===0));cases.push('Production route/inline worker: original 22050 Hz stereo PCM16 metadata; no autoplay');
  await page.screenshot({path:path.join(output,'desktop-waveform.png')});
  await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForFunction(()=>document.querySelector('audio').currentTime>.25,null,{timeout:10000}).catch(async error=>{console.error('Playback diagnostics:',await page.evaluate(()=>{const a=document.querySelector('audio');return{paused:a.paused,time:a.currentTime,ready:a.readyState,network:a.networkState,error:a.error?.message,src:a.currentSrc,alerts:Array.from(document.querySelectorAll('[role=alert]'),e=>e.textContent)};}));throw error;});await page.getByRole('button',{name:'Pause',exact:true}).click();
  const paused=await page.evaluate(()=>document.querySelector('audio').currentTime);await page.waitForTimeout(150);assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('audio').currentTime)-paused)<.05);cases.push('Real HTML audio plays after click and pauses without drifting');
  await page.getByLabel('Speed',{exact:true}).selectOption('1.5');assert.equal(await page.evaluate(()=>document.querySelector('audio').playbackRate),1.5);
  await page.getByRole('button',{name:'Mute',exact:true}).click();assert.equal(await page.evaluate(()=>document.querySelector('audio').muted),true);await page.getByRole('button',{name:'Unmute',exact:true}).click();
  await page.getByLabel('Volume',{exact:true}).fill('0.35');assert.equal(await page.evaluate(()=>document.querySelector('audio').volume),.35);cases.push('Playback speed, volume and mute update native media');
  const rect=await page.getByTestId('waveform').boundingBox();
  await page.mouse.click(rect.x+rect.width*.6,rect.y+70);assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('audio').currentTime)-6)<.1);cases.push('Clicking waveform seeks to its corresponding time');
  await page.mouse.move(rect.x+rect.width*.2,rect.y+80);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.3,rect.y+80,{steps:10});await page.mouse.up();
  assert.match(await page.getByTestId('selection').innerText(),/00:02\.000 → 00:03\.000/);
  await page.getByLabel('A–B loop',{exact:true}).check();await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(1900);
  let time=await page.evaluate(()=>document.querySelector('audio').currentTime);assert.ok(time>=1.99&&time<3.05);await page.getByRole('button',{name:'Pause',exact:true}).click();cases.push('Dragging creates selection; A–B loop returns playback to selected bounds');
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();assert.equal(await page.locator('.audio-zoom span').textContent(),'2.0×');
  const before=await page.getByTestId('waveform').screenshot();await page.getByRole('button',{name:'Pan',exact:true}).click();await page.mouse.move(rect.x+rect.width*.5,rect.y+80);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.8,rect.y+80,{steps:10});await page.mouse.up();
  const after=await page.getByTestId('waveform').screenshot();assert.notDeepEqual(after,before);assert.equal(await page.getByTestId('selection').innerText(),'00:02.000 → 00:03.000 · 00:01.000');cases.push('Zoomed waveform pans without changing selection');
  await page.getByTestId('overview').click({position:{x:rect.width*.85,y:20}});const overviewImage=await page.getByTestId('waveform').screenshot();assert.notDeepEqual(overviewImage,after);
  await page.getByRole('button',{name:'Full track',exact:true}).click();assert.equal(await page.locator('.audio-zoom span').textContent(),'1.0×');cases.push('Overview navigates a zoomed track and Full track restores view');
  await page.getByLabel('A–B loop',{exact:true}).uncheck();await page.getByRole('button',{name:'Clear selection',exact:true}).click();assert.ok(await page.getByLabel('A–B loop',{exact:true}).isDisabled());
  await page.mouse.move(rect.x+rect.width*.25,rect.y+80);await page.mouse.wheel(0,-350);await page.waitForTimeout(100);assert.notEqual(await page.locator('.audio-zoom span').textContent(),'1.0×');cases.push('Mouse wheel zooms the waveform');
  await page.getByRole('button',{name:'Full track',exact:true}).click();await page.getByLabel('Playback position',{exact:true}).fill('4.25');await page.reload();await ready(page);assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('audio').currentTime)-4.25)<.05);assert.equal(await page.getByTestId('cache-status').textContent(),'Cached waveform');cases.push('Host position message restores time on reopen; IndexedDB restores waveform');
  await page.setViewportSize({width:420,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(output,'narrow-waveform.png')});cases.push('420px layout wraps transport without horizontal overflow');
  await page.close();
  for(const name of ['mono24.wav','float.wav','sample.mp3','sample.flac','sample.ogg','sample.m4a']){
   const codec=await open(name);await codec.waitForFunction(()=>document.querySelector('[data-testid="waveform"]')||document.querySelector('[role="alert"]'),{timeout:25000});
   const waveform=await codec.getByTestId('waveform').count();const playable=await codec.evaluate(()=>!document.querySelector('audio').error&&document.querySelector('audio').duration>0);
   if(playable){await codec.getByRole('button',{name:'Play',exact:true}).click();await codec.waitForFunction(()=>document.querySelector('audio').currentTime>.1);}
   codecResults.push({name,waveform:!!waveform,playable,metadata:await codec.locator('.audio-meta').innerText()});assert.ok(playable&&waveform);await codec.close();
  }cases.push('Real Chrome decoders: WAV PCM24/float32, MP3, FLAC, OGG and AAC in M4A');
  const long=await open('long.wav');await ready(long);assert.ok((await long.locator('.audio-meta').innerText()).includes('07:00.000'));cases.push('35 MiB PCM WAV generates bounded streamed waveform beyond generic decode limit');await long.close();
  const broken=await open('broken.wav');await broken.waitForFunction(()=>document.querySelector('[data-testid="wave-status"]')?.textContent.includes('incomplete'));assert.equal(await broken.getByTestId('waveform').count(),0);cases.push('Truncated PCM produces explicit waveform error, no fake waveform');await broken.close();
  const cancel=await open('long.wav','cancel');await cancel.getByRole('button',{name:'Cancel waveform',exact:true}).click();await cancel.waitForFunction(()=>document.querySelector('[data-testid="wave-status"]')?.textContent.includes('cancelled'));assert.equal(await cancel.getByTestId('waveform').count(),0);cases.push('Cancel terminates waveform work while native audio remains available');await cancel.close();
  await require('./analysis.scenarios.cjs')({open,ready,cases,output});
  assert.deepEqual(errors,[]);cases.push('No uncaught browser errors or framework error overlays');
  const result={status:'passed',output,baseUrl:base,browser:'Google Chrome / production webview + HTML audio + inline workers; physical output disabled',cases,codecResults,errors};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);console.error('Test output:',output);process.exitCode=1;});
