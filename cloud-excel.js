/* Excel y PDF son operaciones independientes, con recuperación por operación. */
(function(){
'use strict';
const suffix=window.CimagrafSharePointPilot===true?'-sharepoint-prueba':'';
const $=id=>document.getElementById(id),KEY='cimagraf-excel-pending-v1'+suffix,EDITOR='cimagraf-editor-copy-v1'+suffix;
let running=false,job,copy;
try{job=JSON.parse(localStorage.getItem(KEY)||'null');}catch(_){job=null;}
try{copy=JSON.parse(localStorage.getItem(EDITOR)||'null');}catch(_){copy=null;}
function remember(value){localStorage.setItem(KEY,JSON.stringify(value));job=value;}
function rememberCopy(value){copy=value;if(value)localStorage.setItem(EDITOR,JSON.stringify(value));else localStorage.removeItem(EDITOR);}
function currentCopy(){return copy&&copy.pendingId===(job?.id||null)?copy:null;}
function cloudTarget(value,draft=value?.draft){
 if(value?.cloudTarget)return value.cloudTarget;
 if(value?.plan||value?.lockAcquired||value?.pdfStarted||value?.pdfId||value?.saved||
    value?.excelReceipt||value?.pdfReceipt||draft?.attempt||draft?.sent)return 'onedrive';
 return window.CimagrafSharePointDestination?'sharepoint':'onedrive';
}
const service=value=>cloudTarget(value)==='sharepoint'?'SharePoint':'OneDrive';
function canCorrect(value=job){return !!value&&!value.excelReceipt&&!value.pdfReceipt&&!value.plan&&!value.pdfStarted&&!value.saved&&(!value.lockAcquired||value.lockReleased);}
function editing(){return !!job?.editing&&canCorrect();}
function preserveEdits(){
 if(!job){if(copy)rememberCopy({pendingId:null,snapshot:window.CimagrafArchive.snapshot()});return;}
 if(!running&&editing()){
  job.snapshot=window.CimagrafArchive.snapshot();job.draft=window.CimagrafProduction.state();remember(job);rememberCopy(null);
 }else{rememberCopy({pendingId:job.id,snapshot:window.CimagrafArchive.snapshot()});ui();}
}
function blocked(){return running||!!job&&!editing();}
function excelSaved(){return !!(job?.excelReceipt?.saved||job?.kind!=='pdf'&&job?.saved);}
function pdfSaved(){return !!(job?.pdfReceipt?.saved||job?.pdfConfirmed||job?.saved&&(job.kind==='pdf'||job.pdfId||job.pdfUrl));}
function done(){return !running&&excelSaved()&&pdfSaved()&&!!job?.lockReleased&&!!job?.saved;}
function completedExcel(){return !running&&excelSaved()&&!pdfSaved()&&job?.saved&&job.lockReleased?job:null;}
function completedPDF(){return !running&&pdfSaved()&&!excelSaved()&&job?.saved&&job.lockReleased?job:null;}
const canSaveReceiptPDF=()=>!!completedExcel();
const canSaveReceiptExcel=()=>!!completedPDF();
window.CimagrafSaveUI={blocked,canSaveReceiptPDF,canSaveReceiptExcel,printSnapshot:()=>excelSaved()?(job.excelReceipt||job):pdfSaved()?(job.pdfReceipt||job):null};
function message(text,error=false){$('cloud-status').textContent=text;$('cloud-status').classList.toggle('cloud-error',error);if($('cloud-error-details'))$('cloud-error-details').hidden=true;}
function errorDetails(error){
 const d=error.details,panel=$('cloud-error-details'),info=$('cloud-error-info');
 if(!d||!panel||!info)return;
 info.textContent=[d.step&&'Paso: '+d.step,d.status&&'Estado: '+d.status,d.code&&'Código: '+d.code,d.microsoftMessage&&'Microsoft: '+d.microsoftMessage,d.requestId&&'Referencia: '+d.requestId].filter(Boolean).join('\n');
 panel.hidden=false;
}
function finishPDF(){
 const receipt=job.excelReceipt,changes=currentCopy();
 if(receipt){receipt.pdfUrl=job.pdfUrl;receipt.pdfConfirmed=true;remember(receipt);if(changes)rememberCopy({...changes,pendingId:receipt.id});}
}
function ui(){
 const settled=!!job?.saved&&!!job?.lockReleased;
 // El estado de OneDrive bloquea nuevos envíos, nunca los campos del editor.
 $('multi-root').inert=false;
 for(const [id,confirmed,available,label] of [
  ['multi-register',excelSaved(),canSaveReceiptExcel(),'Guardar en Excel'],
  ['multi-save-pdf',pdfSaved(),canSaveReceiptPDF(),'Guardar PDF en '+service(job)]
 ]){
  const button=$(id);
  button.classList.toggle('save-confirmed',confirmed);
  button.textContent=confirmed?(id==='multi-register'?'✓ Excel guardado':'✓ PDF guardado'):label;
  if(blocked())button.disabled=confirmed||!available;
 }
 const heading=$('cloud-heading');if(heading)heading.textContent='Registro en '+service(job);
 $('machine-select').disabled=blocked()||window.CimagrafProduction.metadata().runMode==='production'||!!window.CimagrafProduction.state()?.sent;
 $('cloud-retry').hidden=!job||settled||running;
 $('cloud-edit').hidden=!job;
 $('cloud-next').hidden=!done();
 $('cloud-next').textContent=currentCopy()?'Continuar con cambios como nuevo registro':'Siguiente grupo';
}
// El porcentaje representa etapas, no bytes transferidos ni tiempo restante.
let savePercent=0,saveLabel='';
function showProgress(value,step,error=false){
 const panel=$('save-progress');
 savePercent=value;
 panel.classList.toggle('is-error',error);
 panel.classList.toggle('is-complete',value===100);
 $('save-progress-bar').value=value;
 $('save-progress-label').textContent=saveLabel+' · '+value+' % · '+step;
 panel.hidden=false;
}
async function save(){
 if(running||!job)return;running=true;ui();
 saveLabel=job.kind==='pdf'?'PDF':'Excel';
 showProgress(20,'Conectando con '+service(job)+'…');
 try{
  job.cloudTarget=cloudTarget(job);remember(job);
  message('Conectando con '+service(job)+'. Conservamos los datos mientras se guardan…');
  const cloud=await window.CimagrafCloud.connect(job.kind||'legacy',job.draft?.machine||job.snapshot.result.machineKey,job.cloudTarget);if(!cloud){showProgress(20,'Inicia sesión en Microsoft.');return;}
  showProgress(20,'Preparando el guardado…');
  const identity=await window.CimagrafProduction.prepare(cloud);
  Object.assign(job.snapshot.result,identity);job.snapshot.result.group=identity.recordId;job.snapshot.group=identity.recordId;
  job.draft=window.CimagrafProduction.state();remember(job);
  const store=window.CimagrafExcelStore.create({cloud,remember,status:message,onWrite:()=>showProgress(60,'Guardando y esperando confirmación…'),
   loadTemplate:async()=>{const response=await fetch('assets/Registro_Bobinas_Cimagraf.xlsx?v=5.0.0',{cache:'no-cache'});if(!response.ok)throw Error('No se pudo preparar el Excel. Revisa Internet y reintenta.');return response.arrayBuffer();},
   renderPDF:(result,created)=>window.CimagrafReportPDF.render(window.CimagrafArchive.reportHTML(result,created))
  });
  if(job.kind==='pdf'){
   await store.savePDF(job);
   finishPDF();
   message(excelSaved()?'Excel y PDF guardados. Ya puedes iniciar el siguiente grupo.':'PDF guardado. Guarda el Excel para continuar.');
  }else{
   await store.save(job);
   window.CimagrafProduction.complete();job.draft=window.CimagrafProduction.state();remember(job);
   message((pdfSaved()?'Excel y PDF guardados. Ya puedes iniciar el siguiente grupo.':'Excel guardado. Guarda el PDF para continuar.')+(currentCopy()?' Tus cambios posteriores siguen en un borrador sin enviar.':''));
  }
  showProgress(100,'Guardado confirmado');
 }catch(e){
  showProgress(savePercent,'Guardado sin confirmar. Revisa el aviso.',true);
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
  await navigator.locks.request('cimagraf-excel-save'+suffix,{ifAvailable:true},async lock=>{
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
  const pending={id:previous?.id||(kind==='excel'?draft.id+'-excel':crypto.randomUUID()),kind,created:receipt?.created||previous?.created||new Date().toISOString(),snapshot,draft,naming:previous?.naming||1};
  pending.cloudTarget=cloudTarget(receipt||previous,draft);
  if(receipt)pending[kind==='pdf'?'excelReceipt':'pdfReceipt']=receipt;
  const changes=currentCopy();
  remember(pending);
  if(receipt&&changes)rememberCopy({...changes,pendingId:pending.id});else rememberCopy(null);
  await guardedSave();
 }catch(e){message('No se pudo conservar el grupo: '+e.message,true);ui();}
}
$('multi-register').addEventListener('click',()=>start('excel',completedPDF()));
$('multi-save-pdf').addEventListener('click',()=>{
 const receipt=completedExcel();
 return start('pdf',receipt);
});
$('cloud-retry').addEventListener('click',guardedSave);
$('cloud-edit').addEventListener('click',()=>{
 if(!job)return;
 if(!running&&canCorrect()){job.editing=true;remember(job);}
 ui();window.CimagrafArchive.refresh();message(editing()?'Puedes corregir los datos y volver a guardar.':'Puedes editar el borrador. El guardado anterior se conserva por separado y se recupera con Reintentar.');
 $('multi-root').querySelector?.('input:not([readonly])')?.focus();
});
$('multi-root').addEventListener('input',preserveEdits);
$('multi-root').addEventListener('change',preserveEdits);
$('cloud-next').addEventListener('click',()=>{
 if(!done())return;
 $('save-progress').hidden=true;
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
  message(editing()?'Recuperamos tus datos. Puedes editarlos y volver a guardar.':done()?'Excel y PDF guardados. Ya puedes iniciar el siguiente grupo.':excelSaved()?'Excel guardado. Guarda el PDF para continuar.':pdfSaved()?'PDF guardado. Guarda el Excel para continuar.':'Recuperamos el grupo pendiente. Pulsa Reintentar para continuar sin duplicarlo.');
  // Regreso de la autenticación corporativa iniciada con Guardar en Excel.
  if(returning&&!job.saved)guardedSave();
 }catch(e){message('No se pudo recuperar el grupo. Puedes editar; conserva los datos del navegador para revisar el pendiente.',true);$('multi-root').inert=false;}
}else{if(currentCopy()?.snapshot)window.CimagrafArchive.restore(copy.snapshot);ui();}
})();
