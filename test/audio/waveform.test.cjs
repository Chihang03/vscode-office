const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '../..');
function load(file) {
 const result=buildSync({entryPoints:[path.join(root,file)],bundle:true,platform:'node',format:'cjs',write:false});
 const context={module:{exports:{}},exports:{},console,ReadableStream,Uint8Array,Float32Array,DataView};vm.runInNewContext(result.outputFiles[0].text,context);return context.module.exports;
}
const {readWavWaveform,buildDecodedWaveform,formatTime,clampView}=load('src/react/view/audio/audioModel.ts');
function wav({bits=16,format=1,channels=2,rate=22050,samples=[-.75,.25,0,.5,.75,-.25],odd=false,ext=false}={}) {
 const pcm=Buffer.alloc(samples.length*bits/8);
 samples.forEach((sample,i)=>{
  const at=i*bits/8;
  if(format===3){if(bits===32)pcm.writeFloatLE(sample,at);else pcm.writeDoubleLE(sample,at);}
  else if(bits===8)pcm.writeUInt8(Math.round(sample*128+128),at);
  else if(bits===16)pcm.writeInt16LE(sample*32768,at);
  else if(bits===24)pcm.writeIntLE(sample*8388608,at,3);
  else pcm.writeInt32LE(sample*2147483648,at);
 });
 const fmt=Buffer.alloc(ext?40:16);fmt.writeUInt16LE(ext?65534:format,0);fmt.writeUInt16LE(channels,2);fmt.writeUInt32LE(rate,4);fmt.writeUInt32LE(rate*channels*bits/8,8);fmt.writeUInt16LE(channels*bits/8,12);fmt.writeUInt16LE(bits,14);
 if(ext){fmt.writeUInt16LE(22,16);fmt.writeUInt16LE(bits,18);fmt.writeUInt16LE(format,24);}
 const chunk=(id,data)=>{const h=Buffer.alloc(8);h.write(id);h.writeUInt32LE(data.length,4);return Buffer.concat([h,data,...(data.length%2?[Buffer.alloc(1)]:[])]);};
 const body=Buffer.concat([Buffer.from('WAVE'),...(odd?[chunk('JUNK',Buffer.from([1,2,3]))]:[]),chunk('fmt ',fmt),chunk('data',pcm)]);
 const h=Buffer.alloc(8);h.write('RIFF');h.writeUInt32LE(body.length,4);return Buffer.concat([h,body]);
}
function stream(bytes,split=7){let offset=0;return new ReadableStream({pull(controller){if(offset>=bytes.length){controller.close();return;}controller.enqueue(new Uint8Array(bytes.subarray(offset,offset+split)));offset+=split;}});}
for(const [format,bits] of [[1,8],[1,16],[1,24],[1,32],[3,32],[3,64]]) test(`Source metadata and independent stereo amplitudes: format ${format}, ${bits} bit`,async()=>{
 const result=await readWavWaveform(stream(wav({bits,format}),1),()=>{});
 assert.equal(result.metadata.sampleRate,22050);assert.equal(result.metadata.channels,2);assert.equal(result.metadata.bits,bits);assert.equal(result.metadata.original,true);assert.equal(result.bins,3);
 assert.deepEqual(Array.from(result.peaks[0]),[-.75,-.75,0,0,.75,.75]);assert.deepEqual(Array.from(result.peaks[1]),[.25,.25,.5,.5,-.25,-.25]);
});
test('Odd-sized unknown chunks and extensible mono PCM are parsed across chunk boundaries',async()=>{
 const result=await readWavWaveform(stream(wav({channels:1,odd:true,ext:true}),3),()=>{});assert.equal(result.metadata.channels,1);assert.equal(result.peaks.length,1);
});
test('Peak envelope retains transients and is bounded for long files',async()=>{
 const samples=new Array(180000).fill(0);samples[99999]=.75;samples[100001]=-.75;
 const result=await readWavWaveform(stream(wav({channels:1,rate:1000,samples}),65536),()=>{});
 assert.equal(result.bins,65536);assert.equal(result.peaks[0].reduce((a,b)=>Math.max(a,b),-Infinity),.75);assert.equal(result.peaks[0].reduce((a,b)=>Math.min(a,b),Infinity),-.75);
});
test('Truncated and empty data are rejected',async()=>{
 const bytes=wav();await assert.rejects(readWavWaveform(stream(bytes.subarray(0,bytes.length-3)),()=>{}),/incomplete/);
 await assert.rejects(readWavWaveform(stream(wav({samples:[]})),()=>{}),/empty/);
});
test('Compressed WAV and non-finite float samples have explicit errors',async()=>{
 await assert.rejects(readWavWaveform(stream(wav({format:6})),()=>{}),/unsupportedWav/);
 await assert.rejects(readWavWaveform(stream(wav({format:3,bits:32,samples:[NaN,0]})),()=>{}),/invalidSamples/);
});
test('Decoded waveform does not label the browser resampling rate as original',()=>{
 const result=buildDecodedWaveform([new Float32Array([0,.25,-.5])],48000);assert.equal(result.metadata.original,false);assert.equal(result.metadata.bits,undefined);assert.equal(result.metadata.sampleRate,48000);
});
test('Viewport clamps both edges, zoom limits and time formatting',()=>{
 assert.equal(clampView({zoom:100,start:100},10).zoom,32);assert.equal(clampView({zoom:4,start:100},10).start,7.5);assert.equal(clampView({zoom:.2,start:-1},10).start,0);assert.equal(formatTime(3661.123),'1:01:01.123');assert.equal(formatTime(NaN),'00:00.000');
});
module.exports={wav};
