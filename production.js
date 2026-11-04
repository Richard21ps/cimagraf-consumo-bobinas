/* Asignación de equipo y paso de pruebas a producción, sin cambiar el motor de kg. */
(function(){
'use strict';
const $=id=>document.getElementById(id),CONFIG='cimagraf-machine-v1',DRAFT='cimagraf-registration-v1';
const machines=window.CimagrafRegistry.machines;
let config={},draft=null,busy=false,forward=false,legacy=false;
const parse=(storage,key)=>{try{return JSON.parse(storage.getItem(key)||'null');}catch(_){return null;}};
config=parse(localStorage,CONFIG)||{};
if(!machines[config.machine])config={};
draft=parse(sessionStorage,DRAFT);
if(!draft||!machines[draft.machine]||typeof draft.id!=='string')draft=null;
const pending=parse(sessionStorage,'cimagraf-pdf-pending-v1');
legacy=!!pending&&!pending.snapshot?.result?.machine;
if(draft)config.machine=draft.machine;
const connected=()=>['machine','recordId'].every(k=>/^r[a-z0-9]{32}$/.test(window.CimagrafMachineForm?.[k]||''));
function persist(){localStorage.setItem(CONFIG,JSON.stringify(config));if(draft)sessionStorage.setItem(DRAFT,JSON.stringify(draft));else sessionStorage.removeItem(DRAFT);}
function makeDraft(){
 if(!config.machine)return;
 draft={id:crypto.randomUUID(),machine:config.machine,mode:config.production?'production':'test',number:config.production?(config.next||1):(config.testNext||1),sent:false};
 persist();
}
function id(){
 if(!draft)return '';
 return (draft.mode==='test'?'PRUEBA · ':'')+window.CimagrafRegistry.recordId(draft.machine,draft.number);
}
function metadata(){return legacy?{}:{machine:machines[draft?.machine||config.machine]||'',machineKey:draft?.machine||config.machine||'',runMode:draft?.mode||'test',recordId:id()};}
function status(message,error=false){$('machine-status').textContent=message;$('machine-status').classList.toggle('machine-error',error);}
function render(){
 const machine=machines[config.machine];
 $('machine-select').value=config.machine||'';
 $('machine-select').disabled=busy||!!draft?.sent||!!config.production||legacy;
 $('machine-name').textContent=machine||'Asigna esta computadora';
 $('machine-mode').textContent=config.production?'PRODUCCIÓN':'PRUEBAS';
 $('machine-mode').classList.toggle('is-production',!!config.production);
 $('machine-start').hidden=!!config.production||legacy;
 $('machine-start').disabled=!machine||busy||!!draft?.sent||!connected();
 $('machine-setup').open=!machine;
 $('machine-connection-note').hidden=connected()||!!config.production||legacy;
 if(!legacy){$('multi-group').value=id();$('multi-group').readOnly=true;$('multi-group').placeholder='Se genera al asignar la máquina';}
 if(legacy)status('Termina el registro anterior antes de configurar la máquina.');
 else if(!machine)status('Elige la máquina de esta PC.');
 else status(config.production?(draft?.sent?'ID registrado; se conserva al reabrir.':'ID confirmado al enviar.'):'No consume IDs de producción.');
 window.CimagrafArchive.refresh();
}
function newGroup(){
 legacy=false;draft=null;sessionStorage.removeItem(DRAFT);makeDraft();render();
}
window.CimagrafProduction={metadata,ready:()=>legacy||!!draft,reset:newGroup};
if(!legacy&&!draft)makeDraft();
$('machine-select').addEventListener('change',()=>{
 if(busy||draft?.sent||config.production){render();return;}
 const machine=$('machine-select').value;
 if(!machines[machine])return;
 config={machine,testNext:1};draft=null;
 try{makeDraft();render();}catch(e){status('No se pudo recordar el equipo. Habilita el almacenamiento del navegador.',true);}
});
async function run(action){
 if(busy||!draft)return;
 busy=true;$('multi-root').inert=true;
 try{
  if(action==='activate'&&!connected())throw new Error('Primero conecta Máquina e ID de registro con Forms.');
  if(action==='send'&&!window.CimagrafArchive.preflight())return;
  draft.action=action;draft.snapshot=window.CimagrafArchive.snapshot();persist();
  if(action==='activate'||draft.mode==='production'){
   if(!connected())throw new Error('Falta conectar los campos nuevos de Forms.');
   status(action==='activate'?'Preparando la numeración de esta máquina…':'Confirmando el ID en OneDrive…');
   const cloud=await window.CimagrafCloud.connect();if(!cloud)return;
   const registry=window.CimagrafRegistry.create({request:cloud.request,saveAttempt:()=>persist()});
   const parent=await registry.open(cloud.destination,draft.machine);
   if(action==='activate'){
    const next=await registry.next(parent);
    config.production=true;config.next=next;draft=null;makeDraft();
    $('machine-start-confirm').hidden=true;
   }else if(!draft.sent){
    const allocation=await registry.reserve(parent,draft.machine,draft);
    draft.number=allocation.number;draft.sent=true;config.next=allocation.number+1;
   }
  }else if(!draft.sent){draft.sent=true;config.testNext=draft.number+1;}
  delete draft.action;delete draft.snapshot;persist();render();
  if(action==='send'){
   // El motor prepara el mismo URL precargado y el guardado PDF de siempre.
   $('multi-root').inert=false;
   if(!window.CimagrafArchive.preflight())return;
   forward=true;
   try{$('multi-register').click();}finally{forward=false;}
  }
 }catch(e){status(e.message||'No se pudo confirmar el ID. Tus datos se conservan; vuelve a intentar.',true);}
 finally{
  busy=false;
  if(!$('forms-modal').classList.contains('open'))$('multi-root').inert=false;
  $('machine-select').disabled=!!draft?.sent||!!config.production||legacy;
  $('machine-start').disabled=!config.machine||!!draft?.sent||!connected();
 }
}
$('machine-start').addEventListener('click',()=>{$('machine-start-confirm').hidden=false;});
$('machine-start-cancel').addEventListener('click',()=>{$('machine-start-confirm').hidden=true;});
$('machine-start-confirm-button').addEventListener('click',()=>run('activate'));
document.addEventListener('click',event=>{
 if(!event.target.closest('#multi-register')||forward||legacy)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(busy||$('forms-modal').classList.contains('open'))return;
 if(!draft){$('machine-setup').open=true;status('Asigna la máquina antes de registrar.',true);return;}
 run('send');
},true);
window.addEventListener('storage',event=>{
 if(event.key!==CONFIG)return;
 const latest=parse(localStorage,CONFIG);
 if(latest?.machine!==config.machine){status('La asignación cambió en otra pestaña. Termina este trabajo antes de recargar.',true);return;}
 if(latest?.production&&!config.production&&!draft?.sent){config=latest;draft=null;makeDraft();render();}
});
render();
// Conserva los datos antes de redirigir a Microsoft y retoma la misma reserva al volver.
if(draft?.action){const action=draft.action;if(draft.snapshot)window.CimagrafArchive.restore(draft.snapshot);run(action);}
})();
