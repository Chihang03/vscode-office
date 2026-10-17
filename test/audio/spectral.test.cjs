const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const vm=require('node:vm');
const path=require('node:path');
function load(file){const result=buildSync({entryPoints:[path.resolve(__dirname,'../../src/react/view/audio',file)],bundle:true,platform:'node',format:'cjs',write:false});const context={module:{exports:{}},console,ReadableStream,Uint8Array,Float32Array,Float64Array,DataView};vm.runInNewContext(result.outputFiles[0].text,context);return context.module.exports;}
const {fft,amplitudeSpectrum,modulationSpectrum,analyzeWav,frequencyAt}=load('spectralModel.ts');
const {visitWavWindows}=load('audioModel.ts');
function wav({rate=8192,seconds=4,channels=2,sample=(t,c)=>.25*(1+.8*Math.cos(2*Math.PI*(c?47:37)*t))*Math.cos(2*Math.PI*1024*t)}={}){
 const frames=Math.round(rate*seconds),bytes=Buffer.alloc(44+frames*channels*4);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(3,20);bytes.writeUInt16LE(channels,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*channels*4,28);bytes.writeUInt16LE(channels*4,32);bytes.writeUInt16LE(32,34);bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);
 for(let n=0;n<frames;n++)for(let c=0;c<channels;c++)bytes.writeFloatLE(sample(n/rate,c),44+(n*channels+c)*4);
 return bytes;
}
function stream(bytes,split=8191){let offset=0;return new ReadableStream({pull(controller){if(offset>=bytes.length){controller.close();return;}controller.enqueue(new Uint8Array(bytes.subarray(offset,offset+split)));offset+=split;}});}
const options={start:0,end:4,viewStart:0,viewEnd:4,fftSize:8192,channels:[0,1],minFrequency:900,maxFrequency:1100,logarithmic:false};
function peak(values,step,min,max){let best=-Infinity,at=0;for(let i=Math.ceil(min/step);i<=Math.min(values.length-1,Math.floor(max/step));i++)if(values[i]>best){best=values[i];at=i*step;}return {frequency:at,db:best};}
test('FFT round trip and coherent-gain sine amplitude including DC and Nyquist',()=>{
 const signal=Float64Array.from({length:8192},(_,i)=>.5*Math.cos(2*Math.PI*1000*i/8192));
 const real=signal.slice(),imaginary=new Float64Array(8192);fft(real,imaginary);fft(real,imaginary,true);
 assert.ok(real.every((value,i)=>Math.abs(value-signal[i])<1e-9));
 assert.ok(Math.abs(amplitudeSpectrum(signal,8192)[1000]-.5)<1e-6);
 assert.ok(Math.abs(amplitudeSpectrum(new Float32Array(2048).fill(.25),2048)[0]-.25)<1e-8);
 const nyquist=Float32Array.from({length:2048},(_,i)=>i%2?-.25:.25);assert.ok(Math.abs(amplitudeSpectrum(nyquist,2048)[1024]-.25)<1e-8);
});
test('Streaming overlapping windows retain exact source samples and stop before the file tail',async()=>{
 const bytes=wav({seconds:20,sample:(t,c)=>t/25+c/100});let tailCancelled=false,offset=0;
 const input=new ReadableStream({pull(c){c.enqueue(new Uint8Array(bytes.subarray(offset,offset+1024)));offset+=1024;},cancel(){tailCancelled=true;}});
 const plan=[{start:100,frames:1000},{start:120,frames:20},{start:900,frames:1000},{start:3000,frames:1}];
 await visitWavWindows(input,[1],()=>plan,(samples,w)=>{assert.equal(samples[0].length,w.frames);for(let i=0;i<w.frames;i++)assert.ok(Math.abs(samples[0][i]-((w.start+i)/8192/25+.01))<1e-7);});
 assert.ok(tailCancelled);assert.ok(offset<bytes.length/5);
});
test('ASSR stereo analysis finds the carrier, independent AM sidebands and 37/47 Hz envelope peaks',async()=>{
 const result=await analyzeWav(stream(wav()),options);
 const step=result.metadata.sampleRate/result.fftSize;
 for(const [channel,modulation] of [[0,37],[1,47]]){
  assert.equal(peak(result.spectrum[channel],step,1010,1030).frequency,1024);
  assert.ok(Math.abs(result.spectrum[channel][1024]-20*Math.log10(.25))<.02);
  for(const side of [1024-modulation,1024+modulation])assert.ok(Math.abs(result.spectrum[channel][side]-20*Math.log10(.1))<.02);
  const other=channel?37:47;assert.ok(result.spectrum[channel][1024+other]<-70);
  const envelope=peak(result.modulation[channel],result.modulationStep,30,55);
  assert.ok(Math.abs(envelope.frequency-modulation)<=result.modulationStep);
  assert.ok(Math.abs(envelope.db-20*Math.log10(.8))<.4);
 }
 assert.equal(result.channels.length,2);assert.ok(result.spectrogram.every(c=>c.length===result.rows*result.spectrogramFrames));
});
test('Spectrogram locates a late tone, while selection spectrum excludes it',async()=>{
 const bytes=wav({seconds:4,channels:1,sample:t=>t<2?0:.5*Math.cos(2*Math.PI*1024*t)});
 const result=await analyzeWav(stream(bytes),{...options,channels:[0],start:0,end:1});
 assert.ok(result.spectrum[0].every(db=>db<=-130));
 const row=Math.floor((1024-900)/200*result.rows);
 assert.ok(result.spectrogram[0][row]<-120);
 assert.ok(result.spectrogram[0][(result.spectrogramFrames-1)*result.rows+row]>-10);
 assert.equal(result.start,0);assert.equal(result.end,1);assert.equal(result.viewEnd,4);
});
test('Long ranges have bounded windows, envelope duration and finite silence; short selections adapt',async()=>{
 const silent=wav({seconds:20,channels:1,sample:()=>0});
 const result=await analyzeWav(stream(silent),{...options,channels:[0],end:20,viewEnd:20});
 assert.ok(result.spectrumFrames<=64&&result.spectrogramFrames<=160);assert.ok(result.modulationEnd-result.modulationStart<=8);
 assert.ok(result.modulation[0].every(Number.isFinite));
 const short=await analyzeWav(stream(wav({channels:1})),{...options,channels:[0],start:1,end:1.01});
 assert.ok(short.windowFrames<8192);assert.ok(short.fftSize<8192);assert.ok(short.spectrum[0].every(Number.isFinite));
});
test('Unmodulated carrier has no false 37/47 Hz envelope response; log and Nyquist bounds work',async()=>{
 const samples=Float32Array.from({length:32768},(_,i)=>.5*Math.cos(2*Math.PI*1024*i/8192));
 const result=modulationSpectrum(samples,8192,900,1100);
 assert.ok(peak(result.values,result.step,30,55).db<-70);
 const analyzed=await analyzeWav(stream(wav({channels:1})),{...options,channels:[0],minFrequency:0,maxFrequency:24000,logarithmic:true});
 assert.equal(analyzed.minFrequency,1);assert.equal(analyzed.maxFrequency,4096);assert.equal(frequencyAt(.5,10,1000,true),100);
});
test('Invalid channels/ranges, truncated and non-finite data are rejected',async()=>{
 await assert.rejects(analyzeWav(stream(wav()),{...options,channels:[2]}),/invalidChannel/);
 await assert.rejects(analyzeWav(stream(wav()),{...options,minFrequency:2000,maxFrequency:1000}),/invalidRange/);
 await assert.rejects(analyzeWav(stream(wav()),{...options,fftSize:100}),/invalidRange/);
 await assert.rejects(analyzeWav(stream(wav().subarray(0,100)),options),/incomplete/);
 await assert.rejects(analyzeWav(stream(wav({sample:()=>NaN})),options),/invalidSamples/);
});

test('Saved analysis settings adapt to mono / lower Nyquist without mutating stored preferences',()=>{
 const built=buildSync({entryPoints:[path.resolve(__dirname,'../../src/common/audioAnalysisSettings.ts')],bundle:true,platform:'node',format:'cjs',write:false});const context={module:{exports:{}}};vm.runInNewContext(built.outputFiles[0].text,context);const {restoreAudioAnalysisSettings,parseAudioAnalysisSettings}=context.module.exports;
 const saved={channel:'both',fftSize:65536,minFrequency:900,maxFrequency:1100,logarithmic:true,markers:'37, 47'};
 const adapted=restoreAudioAnalysisSettings(saved,1000,1);assert.equal(adapted.channel,'0');assert.equal(adapted.minFrequency,0);assert.equal(adapted.maxFrequency,500);assert.equal(adapted.fftSize,65536);assert.equal(saved.minFrequency,900);assert.equal(saved.channel,'both');
 assert.equal(restoreAudioAnalysisSettings(saved,48000,2).channel,'both');assert.equal(restoreAudioAnalysisSettings(undefined,48000,2).maxFrequency,24000);assert.equal(parseAudioAnalysisSettings({...saved,fftSize:100}),undefined);
});
