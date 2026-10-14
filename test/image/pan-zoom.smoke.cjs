// Run with an installed Playwright runtime and Chrome/Edge/Chromium; does not install dependencies.
// KIERAN_PLAYWRIGHT_MODULE=/path/to/playwright npm run test:image:smoke
// Optional baseline reproduction: KIERAN_IMAGE_BASE_REF=<commit before the fix>.
// Real component/browser regression for image panning. No VS Code user profile is modified.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const root = process.env.KIERAN_IMAGE_ROOT || path.resolve(__dirname, '../..');
const baselineRef = process.env.KIERAN_IMAGE_BASE_REF;
const { build } = require(path.join(root,'node_modules/esbuild'));
const less = require(path.join(root,'node_modules/less'));
const { chromium } = require(process.env.KIERAN_PLAYWRIGHT_MODULE || 'playwright');
const output = fs.mkdtempSync(path.join(os.tmpdir(),'studio-image-pan-'));
const cases=[];
const errors=[];
const warnings=[];
async function bundle(baseline){
 const folder=path.join(output,baseline?'before':'after');fs.mkdirSync(folder);
 const entry=path.join(folder,'entry.tsx');
 fs.writeFileSync(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import Image from ${JSON.stringify(path.join(root,'src/react/view/image/Image.tsx'))};createRoot(document.getElementById('root')).render(<Image/>);`);
 await build({entryPoints:[entry],outfile:path.join(folder,'app.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',nodePaths:[path.join(root,'node_modules')],define:{global:'globalThis','process.env.NODE_ENV':'"production"'},plugins:[{name:'real-css',setup(builder){
  if(baseline)builder.onLoad({filter:/\/view\/image\/Image\.tsx$/},args=>({contents:execFileSync('git',['show',`${baselineRef}:src/react/view/image/Image.tsx`],{cwd:root}).toString(),loader:'tsx',resolveDir:path.dirname(args.path)}));
  builder.onLoad({filter:/\.less$/},async args=>({contents:(await less.render(baseline&&args.path.endsWith('/image/Image.less')?execFileSync('git',['show',`${baselineRef}:src/react/view/image/Image.less`],{cwd:root}).toString():fs.readFileSync(args.path,'utf8'),{filename:args.path})).css,loader:'css',resolveDir:path.dirname(args.path)}));
 }}]});
 fs.writeFileSync(path.join(folder,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><title>Kieran Document Studio Image Viewer Test</title><link rel="stylesheet" href="app.css"><style>html,body{margin:0;height:100%;background:#1e1e1e;color:#ccc;font-family:Arial}#root{height:100%}</style></head><body><div id="root"></div><script>
 function fixture(w,h,mime,label){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#fafafa';g.fillRect(0,0,w,h);const colors=['#d74949','#3a8dd6','#37a775','#b786d4'];const labels=['TOP LEFT','TOP RIGHT','BOTTOM LEFT','BOTTOM RIGHT'];for(let i=0;i<4;i++){const x=(i%2)*w/2,y=Math.floor(i/2)*h/2;g.fillStyle=colors[i];g.fillRect(x,y,w/2,h/2);g.fillStyle='#fff';g.font=Math.max(15,w/32)+'px Arial';g.textAlign=i%2?'right':'left';g.fillText(labels[i],x+(i%2?w/2-w/30:w/30),y+(i>=2?h/2-h/30:h/12))}g.strokeStyle='#fff';g.lineWidth=2;for(let x=0;x<w;x+=100){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()}for(let y=0;y<h;y+=100){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}return {src:c.toDataURL(mime),title:label}}
 window.fixtureImages=[fixture(1600,1000,'image/png','wide.png'),fixture(1600,1000,'image/jpeg','wide.jpg'),fixture(600,1400,'image/png','portrait.png'),fixture(160,120,'image/png','small.png')];window.messages=[];window.acquireVsCodeApi=()=>({postMessage(message){window.messages.push(message);if(message.type==='images')setTimeout(()=>window.postMessage({type:'images',content:{images:window.fixtureImages,current:0}},'*'),0)},getState(){return{}},setState(){}});
 </script><script src="app.js"></script></body></html>`);
}
async function main(){
 if(baselineRef) await bundle(true);
 await bundle(false);
 const server=http.createServer((req,res)=>{if(req.url==='/favicon.ico'){res.writeHead(204).end();return;}const parts=(req.url||'/after/').split('?')[0].split('/').filter(Boolean);const file=path.join(output,parts[0]||'after',parts[1]||'index.html');if(!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.KIERAN_IMAGE_CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  async function open(which='after'){
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text())});
   await page.goto(base+'/'+which+'/');await page.waitForFunction(()=>{const i=document.querySelector('.image-gallery-center .image-gallery-image');return i?.complete&&i.naturalWidth>0});
   assert.equal(page.url(),base+'/'+which+'/');
   assert.equal(await page.locator('vite-error-overlay, nextjs-portal, webpack-dev-server-client-overlay').count(),0);
   assert.equal(await page.title(),'Kieran Document Studio Image Viewer Test');assert.ok(await page.locator('.image-wheel-toolbar').isVisible());return page;
  }
  async function state(page){return page.evaluate(()=>{const i=document.querySelector('.image-gallery-center .image-gallery-image');const v=i.closest('.image-viewport')||i.closest('.image-gallery-slide');const m=new DOMMatrix(getComputedStyle(i).transform);const r=v.getBoundingClientRect();const ir=i.getBoundingClientRect();return {scale:m.a,x:m.e,y:m.f,index:document.querySelector('.image-gallery-index').textContent.trim(),cursor:getComputedStyle(v).cursor,dragging:v.classList.contains('is-dragging'),vw:v.clientWidth,vh:v.clientHeight,iw:i.offsetWidth,ih:i.offsetHeight,rect:{x:r.x,y:r.y,width:r.width,height:r.height},imageRect:{x:ir.x,y:ir.y,width:ir.width,height:ir.height}}})}
  async function zoom(page,factor=2,point){const s=await state(page);const p=point||{x:s.rect.x+s.rect.width/2,y:s.rect.y+s.rect.height/2};await page.mouse.move(p.x,p.y);await page.mouse.wheel(0,-Math.log(factor)/.001);await page.waitForFunction(previous=>{const i=document.querySelector('.image-gallery-center .image-gallery-image');return Math.abs(new DOMMatrix(getComputedStyle(i).transform).a-previous)>.01},s.scale);return state(page)}
  async function drag(page,dx,dy,outside=false){const s=await state(page);const p={x:s.rect.x+s.rect.width/2,y:s.rect.y+s.rect.height/2};await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+dx,p.y+dy,{steps:8});const during=await state(page);await page.mouse.up();const after=await state(page);if(!outside)assert.ok(!after.dragging);return {during,after}}
  async function fit(page){await page.getByRole('button',{name:'Fit',exact:true}).click();await page.waitForFunction(()=>new DOMMatrix(getComputedStyle(document.querySelector('.image-gallery-center .image-gallery-image')).transform).a===1);return state(page)}
  if(baselineRef) {
  console.log('Baseline viewer mounted');
  const before=await open('before');await zoom(before);await before.screenshot({path:path.join(output,'before-center-only.png')});const broken=await drag(before,100,80);assert.ok(Math.abs(broken.after.x)<1&&Math.abs(broken.after.y)<1);cases.push('Baseline reproduced: enlarged image has no image pan offset');await before.close();
  }
  console.log('Testing fixed viewer');
  const page=await open();const initial=await state(page);const point={x:initial.rect.x+initial.rect.width/2+80,y:initial.rect.y+initial.rect.height/2+60};const sourcePoint={x:(point.x-initial.imageRect.x)/initial.imageRect.width,y:(point.y-initial.imageRect.y)/initial.imageRect.height};let s=await zoom(page,2,point);assert.ok(Math.abs((point.x-s.imageRect.x)/s.imageRect.width-sourcePoint.x)<.002);assert.ok(Math.abs((point.y-s.imageRect.y)/s.imageRect.height-sourcePoint.y)<.002);cases.push('Pointer-centered zoom preserves the image point under the mouse');assert.equal(s.cursor,'grab');
  const moved=await drag(page,110,90);assert.ok(Math.abs(moved.after.x-s.x-110)<2);assert.ok(Math.abs(moved.after.y-s.y-90)<2);assert.equal(moved.during.cursor,'grabbing');assert.equal(moved.after.index,'1 / 4');cases.push('Drag pans both axes, releases cleanly, and does not switch images');
  await fit(page);await zoom(page,4);const edge=await drag(page,3500,2500,true);assert.ok(Math.abs(edge.after.x-(edge.after.iw*edge.after.scale-edge.after.vw)/2)<2);assert.ok(Math.abs(edge.after.y-(edge.after.ih*edge.after.scale-edge.after.vh)/2)<2);assert.ok(!edge.after.dragging);cases.push('Pointer capture reaches upper/left edges and releases outside the viewport');await page.screenshot({path:path.join(output,'after-top-left.png')});
  const otherEdge=await drag(page,-7000,-5000,true);assert.ok(Math.abs(otherEdge.after.x+(otherEdge.after.iw*otherEdge.after.scale-otherEdge.after.vw)/2)<2);assert.ok(Math.abs(otherEdge.after.y+(otherEdge.after.ih*otherEdge.after.scale-otherEdge.after.vh)/2)<2);cases.push('Opposite image edges remain reachable without dragging the image away');await page.screenshot({path:path.join(output,'after-bottom-right.png')});
  await page.mouse.move(400,400);await page.mouse.wheel(0,6000);await page.waitForFunction(()=>new DOMMatrix(getComputedStyle(document.querySelector('.image-gallery-center .image-gallery-image')).transform).a<=1);s=await state(page);assert.equal(s.scale,.25);assert.equal(s.x,0);assert.equal(s.y,0);cases.push('Shrinking to the minimum zoom recenters both axes');
  await fit(page);await zoom(page);s=await state(page);await page.mouse.dblclick(s.rect.x+s.rect.width/2,s.rect.y+s.rect.height/2);s=await state(page);assert.equal(s.scale,1);assert.equal(s.x,0);cases.push('Double-click resets zoom/pan to fit');
  await zoom(page);await drag(page,90,70);await page.locator('.image-gallery-right-nav').click();await page.waitForFunction(()=>document.querySelector('.image-gallery-index').textContent.trim()==='2 / 4');s=await state(page);assert.equal(s.scale,1);assert.equal(s.x,0);await zoom(page);const jpegPan=await drag(page,90,60);assert.ok(jpegPan.after.x>80);cases.push('Arrow navigation resets the view and JPEG images also pan');
  await page.getByRole('button',{name:'Browse',exact:true}).click();s=await state(page);await page.mouse.move(s.rect.x+s.rect.width/2,s.rect.y+s.rect.height/2);await page.mouse.wheel(0,200);await page.waitForFunction(()=>document.querySelector('.image-gallery-index').textContent.trim()==='3 / 4');s=await state(page);assert.equal(s.scale,1);assert.equal(s.y,0);cases.push('Browse wheel switches images and resets the previous transform');
  await page.getByRole('button',{name:'Zoom',exact:true}).click();await zoom(page,2);const portrait=await drag(page,100,100);assert.equal(portrait.after.x,0);assert.ok(portrait.after.y>90);cases.push('Portrait image locks the fitted horizontal axis and pans vertically');
  await page.setViewportSize({width:640,height:720});await page.waitForTimeout(150);s=await state(page);assert.ok(Math.abs(s.x)<=Math.max(0,(s.iw*s.scale-s.vw)/2)+1);assert.ok(Math.abs(s.y)<=Math.max(0,(s.ih*s.scale-s.vh)/2)+1);cases.push('Resizing constrains the existing view to the new bounds');await page.screenshot({path:path.join(output,'narrow-portrait.png')});
  await page.locator('.image-gallery-thumbnail').nth(3).click();await page.waitForFunction(()=>document.querySelector('.image-gallery-index').textContent.trim()==='4 / 4');s=await state(page);assert.equal(s.scale,1);await zoom(page,2);await drag(page,80,80);s=await state(page);assert.equal(s.x,0);assert.equal(s.y,0);cases.push('Thumbnail navigation resets state; small images remain centered');
  await fit(page);s=await state(page);const toolbar=await page.locator('.image-wheel-toolbar').boundingBox();await page.mouse.move(toolbar.x+10,toolbar.y+10);await page.mouse.wheel(0,-500);await page.waitForTimeout(80);assert.equal((await state(page)).scale,s.scale);cases.push('Wheel over controls does not zoom the image');
  await page.evaluate(()=>window.postMessage({type:'images',content:{images:window.fixtureImages,current:2}},'*'));await page.waitForFunction(()=>document.querySelector('.image-gallery-index').textContent.trim()==='3 / 4');await zoom(page,2);assert.ok((await drag(page,0,90)).after.y>80);cases.push('Restored nonzero image index supports zoom/pan');
  await page.evaluate(()=>window.postMessage({type:'images',content:{images:[],current:0}},'*'));await page.waitForFunction(()=>!document.querySelector('.image-gallery-center .image-gallery-image'));await page.mouse.wheel(0,-100);assert.ok(await page.getByRole('button',{name:'Fit',exact:true}).isDisabled());cases.push('Empty image list handles wheel events without crashing');
  assert.deepEqual(errors,[]);cases.push('Page identity, nonblank UI, no framework overlay and no console/page errors');
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({status:'passed',baseUrl:base,viewports:['1280x900','640x720'],browserPlugin:'Browser plugin not available',warnings,cases},null,2));console.log(JSON.stringify({status:'passed',output,warnings,cases},null,2));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);console.error('Test output:',output);process.exitCode=1;});
