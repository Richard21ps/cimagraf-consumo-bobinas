/* Excel y PDF son operaciones independientes, con recuperación por operación. */
(function(){
'use strict';
const $=id=>document.getElementById(id),KEY='cimagraf-excel-pending-v1',EDITOR='cimagraf-editor-copy-v1';
let running=false,job,copy;
let lastPDF;try{lastPDF=JSON.parse(sessionStorage.getItem('cimagraf-last-independent-pdf')||'null');}catch(_){}
try{job=JSON.parse(localStorage.getItem(KEY)||'null');}catch(_){job=null;}
try{copy=JSON.parse(localStorage.getItem(EDITOR)||'null');}catch(_){copy=null;}
function remember(value){localStorage.setItem(KEY,JSON.stringify(value));job=value;}
function rememberCopy(value){copy=value;if(value)localStorage.setItem(EDITOR,JSON.stringify(value));else localStorage.removeItem(EDITOR);}
function currentCopy(){return copy&&copy.pendingId===(job?.id||null)?copy:null;}
function canCorrect(value=job){return !!value&&!value.excelReceipt&&!value.plan&&!value.pdfStarted&&!value.saved&&(!value.lockAcquired||value.lockReleased);}
function editing(){return !!job?.editing&&canCorrect();}
function preserveEdits(){
 if(!job){if(copy)rememberCopy({pendingId:null,snapshot:window.CimagrafArchive.snapshot()});return;}
 if(!running&&editing()){
  job.snapshot=window.CimagrafArchive.snapshot();job.draft=window.CimagrafProduction.state();remember(job);rememberCopy(null);
 }else{rememberCopy({pendingId:job.id,snapshot:window.CimagrafArchive.snapshot()});ui();}
}
function blocked(){return running||!!job&&!editing();}
window.CimagrafSaveUI={blocked};
function message(text,error=false){$('cloud-status').textContent=text;$('cloud-status').classList.toggle('cloud-error',error);if($('cloud-error-details'))$('cloud-error-details').hidden=true;}
function errorDetails(error){
 const d=error.details,panel=$('cloud-error-details'),info=$('cloud-error-info');
 if(!d||!panel||!info)return;
 info.textContent=[d.step&&'Paso: '+d.step,d.status&&'Estado: '+d.status,d.code&&'Código: '+d.code,d.microsoftMessage&&'Microsoft: '+d.microsoftMessage,d.requestId&&'Referencia: '+d.requestId].filter(Boolean).join('\n');
 panel.hidden=false;
}
function link(id,url){
 const a=$(id);a.hidden=true;a.removeAttribute('href');if(!url)return;
 try{const u=new URL(url);if(u.protocol!=='https:'||!/(^|\.)sharepoint\.com$|(^|\.)onedrive\.com$|(^|\.)1drv\.com$/.test(u.hostname))return;a.href=u.href;a.hidden=false;}catch(_){}
}
function finishPDF(){
 lastPDF=job;sessionStorage.setItem('cimagraf-last-independent-pdf',JSON.stringify(job));
 const receipt=job.excelReceipt;
 const changes=currentCopy();
 if(receipt){receipt.pdfUrl=job.pdfUrl;remember(receipt);if(changes)rememberCopy({...changes,pendingId:receipt.id});}
 else{localStorage.removeItem(KEY);job=null;if(changes)rememberCopy({...changes,pendingId:null});window.CimagrafArchive.refresh();}
}
function ui(){
 const done=!!job?.saved&&!!job?.lockReleased;
 // El estado de OneDrive bloquea nuevos envíos, nunca los campos del editor.
 $('multi-root').inert=false;
 if(blocked()){$('multi-register').disabled=true;$('multi-register-4c').disabled=true;$('multi-save-pdf').disabled=true;}
 $('machine-select').disabled=blocked()||window.CimagrafProduction.metadata().runMode==='production'||!!window.CimagrafProduction.state()?.sent;
 $('cloud-retry').hidden=!job||done||running;
 $('cloud-edit').hidden=!job;
 $('cloud-next').hidden=!done;$('cloud-print').hidden=!done||!job.snapshot.result.usedRolls.some(b=>b.left>1e-8);
 link('cloud-excel-link',job?.excelUrl);link('cloud-last-pdf',job?.pdfUrl||lastPDF?.pdfUrl);
 $('cloud-save-pdf').hidden=!done||job?.kind==='pdf';
 $('cloud-next').textContent=currentCopy()?'Continuar con cambios como nuevo registro':'Siguiente grupo';
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
   message(currentCopy()?'Se guardó la versión enviada. Tus cambios posteriores siguen en un borrador sin enviar.':job.kind==='excel'?'Excel confirmado. Puedes guardar el PDF con su botón independiente o iniciar el siguiente grupo.':'Excel y PDF del pendiente anterior confirmados.');
  }
 }catch(e){
  if(job){job.draft=window.CimagrafProduction.state();if(canCorrect()){const changes=currentCopy();if(changes){job.snapshot=changes.snapshot;rememberCopy(null);}job.editing=true;}try{remember(job);}catch(_){}}
  if(editing())window.CimagrafArchive.refresh();
  message((e.message||'No se pudo confirmar el guardado.')+(editing()?' Puedes editar los datos y volver a guardar.':' Puedes editar un borrador; Reintentar recupera la versión enviada anteriormente.'),true);
  errorDetails(e);
 }finally{running=false;ui();}
}
async function guardedSave(){
 if(running)return;
 if(editing()){
  if(!window.CimagrafArchive.preflight())return;
  job.snapshot=window.CimagrafArchive.snapshot();job.draft=window.CimagrafProduction.state();delete job.editing;remember(job);
 }
 if(navigator.locks){
  await navigator.locks.request('cimagraf-excel-save',{ifAvailable:true},async lock=>{
   if(!lock){message('Otra pestaña de este equipo está guardando. Espera a que termine.',true);return;}
   const latest=JSON.parse(localStorage.getItem(KEY)||'null');if(latest?.id===job?.id)job=latest;
   await save();
  });
 }else await save();
}
async function start(kind,receipt=null){
 if(running){message('El guardado sigue en curso. Puedes editar un borrador mientras Microsoft responde.');return;}
 if(job&&!receipt&&!editing()){message('Hay una versión anterior pendiente. Tus cambios quedan en un borrador; Reintentar recupera la versión anterior.');return;}
 if(!receipt&&!window.CimagrafArchive.preflight())return;
 try{
  const draft=window.CimagrafProduction.state(),snapshot=receipt?JSON.parse(JSON.stringify(receipt.snapshot)):window.CimagrafArchive.snapshot();
  const previous=editing()&&job.kind===kind?job:null;
  const pending={id:previous?.id||(kind==='excel'?draft.id+'-excel':crypto.randomUUID()),kind,created:receipt?.created||previous?.created||new Date().toISOString(),snapshot,draft};
  if(receipt)pending.excelReceipt=receipt;
  const changes=currentCopy();
  remember(pending);
  if(receipt&&changes)rememberCopy({...changes,pendingId:pending.id});else rememberCopy(null);
  await guardedSave();
 }catch(e){message('No se pudo conservar el grupo: '+e.message,true);ui();}
}
function saveMachine(machine){
 const selected=window.CimagrafProduction.metadata().machineKey;
 if(selected!==machine){message('La máquina seleccionada es '+(window.CimagrafProduction.metadata().machine||'ninguna')+'. Para evitar errores, elige el botón de esa máquina.',true);return;}
 return start('excel');
}
$('multi-register').addEventListener('click',()=>saveMachine('kirin-1c'));
$('multi-register-4c').addEventListener('click',()=>saveMachine('kirin-4c'));
$('multi-save-pdf').addEventListener('click',()=>start('pdf'));
$('cloud-save-pdf').addEventListener('click',()=>{if(job?.saved&&job.lockReleased)return start('pdf',job);});
$('cloud-retry').addEventListener('click',guardedSave);
$('cloud-edit').addEventListener('click',()=>{
 if(!job)return;
 if(!running&&canCorrect()){job.editing=true;remember(job);}
 ui();window.CimagrafArchive.refresh();message(editing()?'Puedes corregir los datos y volver a guardar.':'Puedes editar el borrador. El guardado anterior se conserva por separado y se recupera con Reintentar.');
 $('multi-root').querySelector?.('input:not([readonly])')?.focus();
});
$('multi-root').addEventListener('input',preserveEdits);
$('multi-root').addEventListener('change',preserveEdits);
$('cloud-print').addEventListener('click',()=>{if(job?.saved)window.CimagrafArchive.print(job.snapshot.result,job.created);});
$('cloud-next').addEventListener('click',()=>{
 if(running||!job?.saved||!job?.lockReleased)return;
 const changes=currentCopy()?.snapshot;
 localStorage.removeItem(KEY);job=null;rememberCopy(null);ui();window.CimagrafArchive.reset();
 if(changes){const identity=window.CimagrafProduction.metadata();if(changes.result)Object.assign(changes.result,identity,{group:identity.recordId});changes.group=identity.recordId;window.CimagrafArchive.restore(changes);rememberCopy({pendingId:null,snapshot:changes});message('Borrador recuperado como nuevo registro. Revisa los datos antes de guardar.');}
 else message('Listo para el siguiente grupo.');
});
window.addEventListener('storage',e=>{
 if(e.key!==KEY||running)return;
 try{
  const latest=JSON.parse(e.newValue||'null');
  if(latest){job=latest;window.CimagrafArchive.restore(currentCopy()?.snapshot||job.snapshot);ui();message(editing()?'Puedes continuar editando los datos recuperados.':job.saved&&job.lockReleased?'Este registro ya se guardó.':'Hay un guardado pendiente. Puedes editar un borrador; Reintentar recupera la versión enviada.');}
  else if(job){
   const old=JSON.parse(e.oldValue||'null'),changes=currentCopy()?.snapshot;job=null;ui();
   if(changes){
    if(old?.kind!=='pdf')window.CimagrafArchive.reset();
    const identity=window.CimagrafProduction.metadata();if(changes.result)Object.assign(changes.result,identity,{group:identity.recordId});changes.group=identity.recordId;
    rememberCopy({pendingId:null,snapshot:changes});window.CimagrafArchive.restore(changes);message('El guardado terminó en otra pestaña. Tu borrador local sigue disponible para revisar.');
   }else if(old?.kind==='pdf'){window.CimagrafArchive.restore(old.snapshot);message('El PDF se guardó en otra pestaña. Excel se guarda por separado.');}
   else{window.CimagrafArchive.reset();message('El grupo se cerró en otra pestaña.');}
  }
 }catch(_){message('No se pudo leer el guardado de la otra pestaña. Conserva tus datos y revisa el pendiente antes de enviar.',true);$('multi-root').inert=false;}
});
if(job?.kind==='pdf'&&job.saved&&job.lockReleased){window.CimagrafArchive.restore(job.snapshot);finishPDF();}
if(job){
 try{
  const returning=/(?:code=|id_token=|client_info=)/.test(location.hash+location.search);
  if(canCorrect()){job.editing=!returning;remember(job);}
  if(job.saved&&job.lockReleased&&job.kind!=='pdf'){window.CimagrafProduction.complete();job.draft=window.CimagrafProduction.state();remember(job);}
  window.CimagrafArchive.restore(currentCopy()?.snapshot||job.snapshot);ui();
  message(editing()?'Recuperamos tus datos. Puedes editarlos y volver a guardar.':job.saved&&job.lockReleased?'Este grupo ya está guardado en Excel. El PDF tiene su propio botón.':'Recuperamos el grupo pendiente. Pulsa Reintentar para continuar sin duplicarlo.');
  // Regreso de la autenticación corporativa iniciada con Guardar en Excel.
  if(returning)guardedSave();
 }catch(e){message('No se pudo recuperar el grupo. Puedes editar; conserva los datos del navegador para revisar el pendiente.',true);$('multi-root').inert=false;}
}else{if(currentCopy()?.snapshot)window.CimagrafArchive.restore(copy.snapshot);ui();}
})();
