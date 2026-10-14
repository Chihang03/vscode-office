const vscode = window.acquireVsCodeApi();
const config = JSON.parse(document.getElementById('studio-config').textContent);
const zh = config.language.startsWith('zh');
const labels = zh ? {save:'保存',svg:'导出 SVG',png:'导出 PNG',fit:'适应窗口',loading:'正在加载图形…',ready:'',readonly:'只读图形',reload:'重新加载（放弃画布中未同步的修改）',conflict:'图形已被其他编辑器修改，请重新加载后继续。',failed:'无法同步图形，请检查错误后重新加载。'} : {save:'Save',svg:'Export SVG',png:'Export PNG',fit:'Fit',loading:'Loading diagram…',ready:'',readonly:'Read-only diagram',reload:'Reload (discard unsynchronized canvas changes)',conflict:'Diagram changed in another editor. Reload before continuing.',failed:'Unable to synchronize diagram. Check the error and reload.'};
const frame = document.getElementById('diagram'), status = document.getElementById('message'), reload = document.getElementById('reload');
for (const [id,key] of [['save','save'],['export-svg','svg'],['export-png','png'],['fit','fit'],['reload','reload']]) document.getElementById(id).textContent=labels[key];
let resource, initialized=false, loading=true, seq=0, pending, queued, conflict=false, lastXml='';
const exports = new Map();
const send = value => frame.contentWindow.postMessage(JSON.stringify(value),'*');
function message(value,error=false){status.textContent=value;status.classList.toggle('error',error);status.hidden=!value;}
function encodePng(bytes){let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.slice(offset,offset+8192));return 'data:image/png;base64,'+btoa(binary);}
function load(){
    if(!resource||!initialized)return;
    loading=true;message(labels.loading);lastXml='';
    let content=resource.format==='png' ? (resource.content.length?encodePng(resource.content):'') : resource.content;
    if(!content.trim())content='<mxfile><diagram id="page-1" name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
    send({action:'load',xml:content,autosave:resource.readOnly?0:1,title:resource.name,saveAndExit:0,noExitBtn:1,exportProtocol:true});
}
function fail(value){conflict=true;message(value||labels.failed,true);reload.hidden=false;document.getElementById('save').disabled=true;}
function pump(){
    if(!queued||pending||conflict||resource.readOnly)return;
    pending={...queued,id:++seq,version:resource.version};queued=undefined;
    const item=pending;
    if(resource.format==='xml')vscode.postMessage({type:'change',content:item.xml,version:item.version,id:item.id,save:item.save});
    else{exports.set(item.id,{kind:'change',item});send({action:'export',format:resource.format==='png'?'xmlpng':'xmlsvg',xml:item.xml,asText:true,embedImages:false,embedFonts:false,requestId:item.id});}
}
function change(xml,save){
    if(loading||conflict||resource.readOnly||typeof xml!=='string')return;
    if(xml===lastXml&&!save)return;
    lastXml=xml;queued={xml,save:!!save||!!queued?.save};pump();
}
window.addEventListener('message',event=>{
    if(event.source===frame.contentWindow){
        let data;try{data=typeof event.data==='string'?JSON.parse(event.data):event.data;}catch{return;}
        if(!data||typeof data.event!=='string')return;
        if(data.event==='configure'){
            send({action:'configure',config:{defaultFonts:['Arial','Helvetica','Verdana'],useInternalClipboard:true,suppressNewWindows:true,hideMenuItems:['print','share','publishLink','collaborate','openLibraryFrom','plugins'],defaultLibraries:'general;flowchart;basic;arrows',preserveViewState:true,passThroughKeys:[{key:'s',ctrl:true,shift:false,alt:false,command:'save'}]}});
        }else if(data.event==='init'){initialized=true;load();}
        else if(data.event==='load'){
            if(data.error){fail(String(data.error));return;}
            loading=false;message(resource.readOnly?labels.readonly:labels.ready);document.getElementById('save').disabled=resource.readOnly;lastXml=data.xml||'';
        }else if(data.event==='autosave')change(data.xml,false);
        else if(data.event==='save')change(data.xml,true);
        else if(data.event==='shortcut'&&data.command==='save')send({action:'invokeAction',actionName:'save'});
        else if(data.event==='export'){
            let request=data.message;try{if(typeof request==='string')request=JSON.parse(request);}catch{return;}
            const entry=exports.get(request?.requestId);if(!entry)return;exports.delete(request.requestId);
            if(data.error||!data.data){fail(data.error||'Diagram export failed');return;}
            if(entry.kind==='change')vscode.postMessage({type:'change',content:data.data,version:entry.item.version,id:entry.item.id,save:entry.item.save});
            else vscode.postMessage({type:'export',format:entry.format,data:data.data});
        }
        return;
    }
    const data=event.data;if(!data||typeof data.type!=='string')return;
    if(data.type==='document'){
        if((pending||queued)&&resource&&data.version!==resource.version&&!conflict){fail(labels.conflict);return;}
        resource=data;document.getElementById('filename').textContent=data.name;frame.inert=!!data.readOnly;
        if(!frame.hasAttribute('src')){
            const params=new URLSearchParams({embed:'1',proto:'json',configure:'1',offline:'1',pwa:'0',local:'1',stealth:'1',plugins:'0',noExitBtn:'1',saveAndExit:'0',libraries:'1',ui:'kennedy',lang:zh?'zh':'en',sync:'none',gapi:'0',picker:'0'});
            const base=config.engine.slice(0,config.engine.lastIndexOf('/')+1);
            const bootstrap='<script>window.STUDIO_PARAMS='+JSON.stringify(Object.fromEntries(params))+';</script>';
            const html=config.editorHtml.replaceAll('{{studioSource}}',config.source).replace('<head>','<head><base href="'+base+'">'+bootstrap);
            const childUrl=new URL('fake.html',window.location.href);childUrl.search=window.location.search||'?id=studio-browser-test';
            frame.onload=()=>{frame.onload=null;const doc=frame.contentDocument;doc.open();doc.write(html);doc.close();};
            frame.src=childUrl.toString();
        }else load();
    }else if(data.type==='ack'&&pending?.id===data.id){resource.version=data.version;pending=undefined;message(resource.readOnly?labels.readonly:labels.ready);pump();}
    else if(data.type==='error')fail(data.message);
});
document.getElementById('save').onclick=()=>send({action:'invokeAction',actionName:'save'});
document.getElementById('fit').onclick=()=>send({action:'fit',maxScale:1});
for(const format of ['svg','png'])document.getElementById('export-'+format).onclick=()=>{
    if(!initialized||loading)return;
    const id=++seq;exports.set(id,{kind:'export',format});send({action:'export',format:format==='svg'?'xmlsvg':'xmlpng',asText:true,embedImages:false,embedFonts:false,requestId:id});
};
reload.onclick=()=>{pending=undefined;queued=undefined;conflict=false;exports.clear();reload.hidden=true;vscode.postMessage({type:'reload'});};
window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();send({action:'invokeAction',actionName:'save'});}});
message(labels.loading);vscode.postMessage({type:'init'});
