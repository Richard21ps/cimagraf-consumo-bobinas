/* Un botón: conserva el grupo, guarda PDF y comprueba las filas de Excel. */
(function(){
'use strict';
const $=id=>document.getElementById(id),KEY='cimagraf-excel-pending-v1';
let running=false,job;
try{job=JSON.parse(localStorage.getItem(KEY)||'null');}catch(_){job=null;}
function remember(value){localStorage.setItem(KEY,JSON.stringify(value));job=value;}
function message(text,error=false){$('cloud-status').textContent=text;$('cloud-status').classList.toggle('cloud-error',error);}
function link(id,url){
 const a=$(id);a.hidden=true;a.removeAttribute('href');if(!url)return;
 try{const u=new URL(url);if(u.protocol!=='https:'||!/(^|\.)sharepoint\.com$|(^|\.)onedrive\.com$|(^|\.)1drv\.com$/.test(u.hostname))return;a.href=u.href;a.hidden=false;}catch(_){}
}
function ui(){
 const done=!!job?.saved&&!!job?.lockReleased;
 $('multi-root').inert=!!job||running;
 $('cloud-retry').hidden=!job||done||running;
 $('cloud-edit').hidden=!job||running||!!job.plan||!!job.pdfStarted||!!job.saved||!!job.lockAcquired&&!job.lockReleased;
 $('cloud-next').hidden=!done;$('cloud-print').hidden=!done||!job.snapshot.result.usedRolls.some(b=>b.left>1e-8);
 link('cloud-excel-link',job?.excelUrl);link('cloud-last-pdf',job?.pdfUrl);
}
async function save(){
 if(running||!job)return;running=true;ui();
 try{
  message('Conectando con OneDrive. Conservamos los datos mientras se guardan…');
  const cloud=await window.CimagrafCloud.connect();if(!cloud)return;
  const identity=await window.CimagrafProduction.prepare(cloud);
  Object.assign(job.snapshot.result,identity);job.snapshot.result.group=identity.recordId;job.snapshot.group=identity.recordId;
  job.draft=window.CimagrafProduction.state();remember(job);
  const store=window.CimagrafExcelStore.create({cloud,remember,status:message,
   loadTemplate:async()=>{const response=await fetch('assets/Registro_Bobinas_Cimagraf.xlsx?v=5.0.0',{cache:'no-cache'});if(!response.ok)throw Error('No se pudo preparar el Excel. Revisa Internet y reintenta.');return response.arrayBuffer();},
   renderPDF:(result,created)=>window.CimagrafReportPDF.render(window.CimagrafArchive.reportHTML(result,created))
  });
  await store.save(job);
  window.CimagrafProduction.complete();job.draft=window.CimagrafProduction.state();remember(job);
  message('Guardado: Excel y PDF confirmados en OneDrive. Puedes imprimir los rótulos o iniciar el siguiente grupo.');
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
$('multi-register').addEventListener('click',async()=>{
 if(running||job||!window.CimagrafArchive.preflight())return;
 try{
  const draft=window.CimagrafProduction.state();
  const pending={id:draft.id,created:new Date().toISOString(),snapshot:window.CimagrafArchive.snapshot(),draft};
  remember(pending);await guardedSave();
 }catch(e){message('No se pudo conservar el grupo. Habilita el almacenamiento del navegador antes de guardar.',true);ui();}
});
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
  else if(job){job=null;ui();window.CimagrafArchive.reset();message('El grupo se cerró en otra pestaña.');}
 }catch(_){message('No se pudo leer el guardado de la otra pestaña. Recarga antes de continuar.',true);$('multi-root').inert=true;}
});
if(job){
 try{
  if(job.saved&&job.lockReleased){window.CimagrafProduction.complete();job.draft=window.CimagrafProduction.state();remember(job);}
  window.CimagrafArchive.restore(job.snapshot);ui();
  message(job.saved&&job.lockReleased?'Este grupo ya está guardado en Excel y PDF.':'Recuperamos el grupo pendiente. Pulsa Reintentar para continuar sin duplicarlo.');
  // Regreso de la autenticación corporativa iniciada con Guardar en Excel.
  if(/(?:code=|id_token=|client_info=)/.test(location.hash+location.search))guardedSave();
 }catch(e){message('No se pudo recuperar el grupo. Conserva los datos del navegador para revisarlos.',true);$('multi-root').inert=true;}
}else ui();
})();
