/* Excel y PDF son operaciones independientes, con recuperación por operación. */
(function(){
'use strict';
const $=id=>document.getElementById(id),KEY='cimagraf-excel-pending-v1';
let running=false,job;
let lastPDF;try{lastPDF=JSON.parse(sessionStorage.getItem('cimagraf-last-independent-pdf')||'null');}catch(_){}
try{job=JSON.parse(localStorage.getItem(KEY)||'null');}catch(_){job=null;}
function remember(value){localStorage.setItem(KEY,JSON.stringify(value));job=value;}
function message(text,error=false){$('cloud-status').textContent=text;$('cloud-status').classList.toggle('cloud-error',error);}
function link(id,url){
 const a=$(id);a.hidden=true;a.removeAttribute('href');if(!url)return;
 try{const u=new URL(url);if(u.protocol!=='https:'||!/(^|\.)sharepoint\.com$|(^|\.)onedrive\.com$|(^|\.)1drv\.com$/.test(u.hostname))return;a.href=u.href;a.hidden=false;}catch(_){}
}
function finishPDF(){
 lastPDF=job;sessionStorage.setItem('cimagraf-last-independent-pdf',JSON.stringify(job));
 const receipt=job.excelReceipt;
 if(receipt){receipt.pdfUrl=job.pdfUrl;remember(receipt);}
 else{localStorage.removeItem(KEY);job=null;window.CimagrafArchive.refresh();}
}
function ui(){
 const done=!!job?.saved&&!!job?.lockReleased;
 $('multi-root').inert=!!job||running;
 $('cloud-retry').hidden=!job||done||running;
 $('cloud-edit').hidden=!job||running||!!job.plan||!!job.pdfStarted||!!job.saved||!!job.lockAcquired&&!job.lockReleased;
 $('cloud-next').hidden=!done;$('cloud-print').hidden=!done||!job.snapshot.result.usedRolls.some(b=>b.left>1e-8);
 link('cloud-excel-link',job?.excelUrl);link('cloud-last-pdf',job?.pdfUrl||lastPDF?.pdfUrl);
 $('cloud-save-pdf').hidden=!done||job?.kind==='pdf';
}
async function save(){
 if(running||!job)return;running=true;ui();
 try{
  message('Conectando con OneDrive. Conservamos los datos mientras se guardan…');
  const cloud=await window.CimagrafCloud.connect(job.kind||'legacy',job.snapshot.result.machineKey);if(!cloud)return;
  const identity=await window.CimagrafProduction.prepare(cloud);
  Object.assign(job.snapshot.result,identity);job.snapshot.result.group=identity.recordId;job.snapshot.group=identity.recordId;
  job.draft=window.CimagrafProduction.state();remember(job);
  const store=window.CimagrafExcelStore.create({cloud,remember,status:message,
   loadTemplate:async()=>{const response=await fetch('assets/Registro_Bobinas_Cimagraf.xlsx?v=5.0.0',{cache:'no-cache'});if(!response.ok)throw Error('No se pudo preparar el Excel. Revisa Internet y reintenta.');return response.arrayBuffer();},
   renderPDF:(result,created)=>window.CimagrafReportPDF.render(window.CimagrafArchive.reportHTML(result,created))
  });
  if(job.kind==='pdf'){
   await store.savePDF(job);
   finishPDF();
   message('PDF confirmado en OneDrive. El guardado de Excel es independiente.');
  }else{
   await store.save(job);
   window.CimagrafProduction.complete();job.draft=window.CimagrafProduction.state();remember(job);
   message(job.kind==='excel'?'Excel confirmado. Puedes guardar el PDF con su botón independiente o iniciar el siguiente grupo.':'Excel y PDF del pendiente anterior confirmados.');
  }
 }catch(e){
  if(job){job.draft=window.CimagrafProduction.state();try{remember(job);}catch(_){}}
  message((e.message||'No se pudo confirmar el guardado.')+' Tus datos siguen aquí.',true);
 }finally{running=false;ui();}
}
async function guardedSave(){
 if(running)return;
 if(navigator.locks){
  await navigator.locks.request('cimagraf-excel-save',{ifAvailable:true},async lock=>{
   if(!lock){message('Otra pestaña de este equipo está guardando. Espera a que termine.',true);return;}
   const latest=JSON.parse(localStorage.getItem(KEY)||'null');if(latest?.id===job?.id)job=latest;
   await save();
  });
 }else await save();
}
async function start(kind,receipt=null){
 if(running||job&&!receipt)return;
 if(!receipt&&!window.CimagrafArchive.preflight())return;
 try{
  const draft=window.CimagrafProduction.state(),snapshot=receipt?JSON.parse(JSON.stringify(receipt.snapshot)):window.CimagrafArchive.snapshot();
  const pending={id:kind==='excel'?draft.id+'-excel':crypto.randomUUID(),kind,created:receipt?.created||new Date().toISOString(),snapshot,draft};
  if(receipt)pending.excelReceipt=receipt;
  remember(pending);await guardedSave();
 }catch(e){message('No se pudo conservar el grupo: '+e.message,true);ui();}
}
$('multi-register').addEventListener('click',()=>start('excel'));
$('multi-save-pdf').addEventListener('click',()=>start('pdf'));
$('cloud-save-pdf').addEventListener('click',()=>{if(job?.saved&&job.lockReleased)return start('pdf',job);});
$('cloud-retry').addEventListener('click',guardedSave);
$('cloud-edit').addEventListener('click',()=>{
 if(running||!job||job.plan||job.pdfStarted||job.saved||job.lockAcquired&&!job.lockReleased)return;
 localStorage.removeItem(KEY);job=null;ui();window.CimagrafArchive.refresh();message('Puedes corregir los datos y volver a guardar.');
});
$('cloud-print').addEventListener('click',()=>{if(job?.saved)window.CimagrafArchive.print(job.snapshot.result,job.created);});
$('cloud-next').addEventListener('click',()=>{
 if(running||!job?.saved||!job?.lockReleased)return;
 localStorage.removeItem(KEY);job=null;ui();window.CimagrafArchive.reset();message('Listo para el siguiente grupo.');
});
window.addEventListener('storage',e=>{
 if(e.key!==KEY||running)return;
 try{
  const latest=JSON.parse(e.newValue||'null');
  if(latest){job=latest;window.CimagrafArchive.restore(job.snapshot);ui();message(job.saved&&job.lockReleased?'Este registro ya se guardó.':'Hay un guardado pendiente en otra pestaña. Conserva el mismo registro.');}
  else if(job){const old=JSON.parse(e.oldValue||'null');job=null;ui();if(old?.kind==='pdf'){window.CimagrafArchive.restore(old.snapshot);message('El PDF se guardó en otra pestaña. Excel se guarda por separado.');}else{window.CimagrafArchive.reset();message('El grupo se cerró en otra pestaña.');}}
 }catch(_){message('No se pudo leer el guardado de la otra pestaña. Recarga antes de continuar.',true);$('multi-root').inert=true;}
});
if(job?.kind==='pdf'&&job.saved&&job.lockReleased){window.CimagrafArchive.restore(job.snapshot);finishPDF();}
if(job){
 try{
  if(job.saved&&job.lockReleased&&job.kind!=='pdf'){window.CimagrafProduction.complete();job.draft=window.CimagrafProduction.state();remember(job);}
  window.CimagrafArchive.restore(job.snapshot);ui();
  message(job.saved&&job.lockReleased?'Este grupo ya está guardado en Excel. El PDF tiene su propio botón.':'Recuperamos el grupo pendiente. Pulsa Reintentar para continuar sin duplicarlo.');
  // Regreso de la autenticación corporativa iniciada con Guardar en Excel.
  if(/(?:code=|id_token=|client_info=)/.test(location.hash+location.search))guardedSave();
 }catch(e){message('No se pudo recuperar el grupo. Conserva los datos del navegador para revisarlos.',true);$('multi-root').inert=true;}
}else ui();
})();
