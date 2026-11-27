/* Máquina de esta PC y numeración central para el registro directo. */
(function(){
'use strict';
const local=window.CimagrafLocalMode===true,pilot=window.CimagrafSharePointPilot===true,suffix=local?'-local':pilot?'-sharepoint-prueba':'';
const $=id=>document.getElementById(id),CONFIG='cimagraf-machine-v1'+suffix,DRAFT='cimagraf-registration-v1'+suffix;
const machines=window.CimagrafRegistry.machines;
const parse=(storage,key)=>{try{return JSON.parse(storage.getItem(key)||'null');}catch(_){return null;}};
let config=parse(localStorage,CONFIG)||{},draft=parse(sessionStorage,DRAFT),busy=false;
const pending=parse(localStorage,'cimagraf-excel-pending-v1'+suffix);
if(pending?.draft&&draft?.id!==pending.draft.id)draft=pending.draft;
if(!machines[config.machine])config={};
if(!draft||!machines[draft.machine]||typeof draft.id!=='string')draft=null;
if(draft)config.machine=draft.machine;
if(local&&!pending?.draft&&draft&&!draft.localPhase)draft.localPhase=draft.mode;
function persist(){if(!local||config.production||!parse(localStorage,CONFIG)?.production)localStorage.setItem(CONFIG,JSON.stringify(config));if(draft)sessionStorage.setItem(DRAFT,JSON.stringify(draft));else sessionStorage.removeItem(DRAFT);}
function makeDraft(){
 if(!config.machine)return;
 draft={id:crypto.randomUUID(),machine:config.machine,mode:config.production?'production':'test',number:config.production?(config.next||1):(config.testNext||1),sent:false};
 if(local)draft.localPhase=draft.mode;
 persist();
}
function id(){return draft?(draft.recordId||(local&&!draft.localPhase?'LOCAL · ':draft.mode==='test'?'PRUEBA · ':'')+window.CimagrafRegistry.recordId(draft.machine,draft.number)):'';}
function metadata(){return {machine:machines[draft?.machine||config.machine]||'',machineKey:draft?.machine||config.machine||'',runMode:local&&draft&&!draft.localPhase?'local':draft?.mode||'test',recordId:id()};}
function status(message,error=false){$('machine-status').textContent=message;$('machine-status').classList.toggle('machine-error',error);}
function render(){
 $('machine-select').value=config.machine||'';
 $('machine-select').disabled=busy||!!draft?.sent||!!config.production||!!window.CimagrafSaveUI?.blocked();
 $('machine-name').textContent=machines[config.machine]||'Asigna esta computadora';
 $('machine-mode').textContent=config.production?'PRODUCCIÓN':'PRUEBAS';$('machine-mode').classList.toggle('is-production',!!config.production);
 $('machine-start').hidden=pilot||!!config.production;
 $('machine-start').disabled=pilot||busy||!draft||!!draft.sent||!!window.CimagrafSaveUI?.hasPending?.();
 $('machine-setup').open=!config.machine;$('machine-connection-note').hidden=!!config.production;
 $('multi-group').value=id();$('multi-group').readOnly=true;
 status(!draft?'Elige la máquina de esta PC.':local?(config.production?'Producción activa en esta PC.':'Las pruebas se guardan aparte de los registros de producción.'):pilot?'Prueba de SharePoint: usa datos de ejemplo.':draft.mode==='test'?'Las pruebas se guardan en una hoja separada.':draft.sent?'Número reservado para este registro.':'El ID se confirma al guardar.');
 window.CimagrafArchive.refresh();
 if(local)window.CimagrafSaveUI?.refreshFolder();
}
function reset(){
 const active=local?parse(localStorage,CONFIG):null;
 if(!config.production&&active?.production&&machines[active.machine])config=active;
 draft=null;sessionStorage.removeItem(DRAFT);makeDraft();render();
}
async function prepare(cloud){
 if(!draft)throw Error('Asigna la máquina de esta PC.');
 if(!local&&draft.mode==='production'&&!draft.sent){
  const registry=window.CimagrafRegistry.create({request:cloud.request,saveAttempt:()=>persist()});
  const parent=await registry.open(cloud.destination,draft.machine);
  const allocated=await registry.reserve(parent,draft.machine,draft);
  draft.number=allocated.number;draft.recordId=allocated.recordId;draft.sent=true;config.next=allocated.number+1;persist();render();
 }
 return metadata();
}
function complete(){
 if(!draft)return;
 draft.saved=true;draft.sent=true;
 if(draft.mode==='test'){
  config.testNext=draft.number+1;
  if(local)config.testCounters={...config.testCounters,[draft.machine]:config.testNext};
 }
 if(local&&draft.mode==='production')config.next=Math.max(config.next||1,draft.number+1);
 persist();render();
}
async function activate(){
 if(pilot||busy||!draft||draft.sent||config.production||window.CimagrafSaveUI?.blocked()||window.CimagrafSaveUI?.hasPending?.())return;
 busy=true;
 $('machine-start-confirm-button').disabled=true;
 try{
  if(local){
   status('Preparando la carpeta de producción…');
   const next=await window.CimagrafLocalStore.prepareProduction(draft.machine);
   const active=parse(localStorage,CONFIG);
   if(active?.production)throw Error('La producción ya se inició en otra pestaña. Recarga la calculadora.');
   if(window.CimagrafSaveUI?.hasPending?.())throw Error('Termina el guardado pendiente antes de iniciar producción.');
   config.production=true;config.next=next;draft=null;
   $('machine-start-confirm').hidden=true;
   window.CimagrafArchive.reset();
   return;
  }
  draft.action='activate';draft.snapshot=window.CimagrafArchive.snapshot();persist();
  status('Confirmando la numeración compartida…');
  const cloud=await window.CimagrafCloud.connect();if(!cloud)return;
  const registry=window.CimagrafRegistry.create({request:cloud.request,saveAttempt:()=>persist()});
  const next=await registry.next(await registry.open(cloud.destination,draft.machine));
  config.production=true;config.next=next;draft=null;makeDraft();$('machine-start-confirm').hidden=true;render();
 }catch(e){status(e.message||'No se pudo iniciar producción. Tus datos se conservan.',true);}
 finally{busy=false;$('machine-start-confirm-button').disabled=false;$('machine-start').disabled=!draft||!!draft.sent||!!window.CimagrafSaveUI?.hasPending?.();}
}
window.CimagrafProduction={metadata,prepare,complete,reset,activating:()=>busy,ready:()=>!!draft,state:()=>draft?JSON.parse(JSON.stringify(draft)):null};
if(!draft)makeDraft();
$('machine-select').addEventListener('change',()=>{
 if(busy||draft?.sent||config.production||window.CimagrafSaveUI?.blocked()||window.CimagrafSaveUI?.hasPending?.()){render();return;}
 const machine=$('machine-select').value;if(!machines[machine])return;
 const testCounters=local?{...config.testCounters,...(config.machine?{[config.machine]:config.testNext||1}:{})}:undefined;
 config={machine,testNext:testCounters?.[machine]||1,testCounters};draft=null;
 try{makeDraft();render();}catch(e){status('Habilita el almacenamiento del navegador para recordar este equipo.',true);}
});
$('machine-start').addEventListener('click',()=>{$('machine-start-confirm').hidden=false;});
$('machine-start-cancel').addEventListener('click',()=>{$('machine-start-confirm').hidden=true;});
$('machine-start-confirm-button').addEventListener('click',activate);
window.addEventListener('storage',e=>{
 if(e.key!==CONFIG)return;
 const latest=parse(localStorage,CONFIG);
 if(latest?.machine!==config.machine){status('La asignación cambió en otra pestaña. Termina este grupo antes de recargar.',true);return;}
 if(latest?.production&&!config.production&&!draft?.sent&&!window.CimagrafSaveUI?.hasPending?.()){
  config=latest;
  if(local)window.CimagrafArchive.reset();else{draft=null;makeDraft();render();}
 }
});
render();
if(draft?.action==='activate'){if(draft.snapshot)window.CimagrafArchive.restore(draft.snapshot);activate();}
})();
