/* Numeración compartida en OneDrive: reservas inmutables, una por ID.
   Nunca se sobrescriben reservas ni se reconstruye el contador desde el navegador. */
(function(scope){
'use strict';
const machines={'kirin-1c':'Kirin 1C','kirin-4c':'Kirin 4C'};
const recordId=(machine,number)=>machines[machine].toUpperCase()+'-'+String(number).padStart(4,'0');
function create({request,saveAttempt}){
 async function folder(parent,name){
  const path=parent+':/'+encodeURIComponent(name);
  try{const item=await request(path);if(!item.folder||!item.id)throw new Error('El control de numeración no es una carpeta válida.');return item;}
  catch(e){if(e.status!==404)throw e;}
  try{return await request(parent+'/children',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'fail'})});}
  catch(e){if(e.status!==409)throw e;const item=await request(path);if(!item.folder||!item.id)throw new Error('No se pudo abrir el control de numeración.');return item;}
 }
 async function open(destination,machine){
  if(!machines[machine])throw new Error('Asigna Kirin 1C o Kirin 4C a este equipo.');
  const drive='/drives/'+encodeURIComponent(destination.drive)+'/items/';
  const root=await folder(drive+encodeURIComponent(destination.id),'_CONTROL_CALCULADORA');
  const selected=await folder(drive+encodeURIComponent(root.id),machine);
  return drive+encodeURIComponent(selected.id);
 }
 async function next(parent){
  let path=parent+'/children?$select=id,name&$top=200',max=0;
  while(path){
   const page=await request(path);
   if(!Array.isArray(page.value))throw new Error('No se pudo leer la numeración compartida.');
   for(const item of page.value){const match=/^(\d{10})\.json$/.exec(item.name||'');if(match)max=Math.max(max,Number(match[1]));}
   const link=page['@odata.nextLink'];path='';
   if(link){const u=new URL(link);if(u.origin!=='https://graph.microsoft.com'||!u.pathname.startsWith('/v1.0/drives/'))throw new Error('Respuesta de numeración no válida.');path=u.pathname.slice('/v1.0'.length)+u.search;}
  }
  if(!Number.isSafeInteger(max)||max>=9999999999)throw new Error('Se alcanzó el límite de numeración.');
  return max+1;
 }
 async function reserve(parent,machine,draft){
  for(let tries=0;tries<8;tries++){
   const number=draft.attempt||await next(parent);
   if(!Number.isSafeInteger(number)||number<1||number>9999999999)throw new Error('Número de registro no válido.');
   const path=parent+':/'+String(number).padStart(10,'0')+'.json:/content';
   // Antes de crear, recupera una respuesta perdida del mismo intento.
   if(draft.attempt){
    try{const old=await request(path);if(old.draftId===draft.id&&old.machine===machine&&old.number===number)return {number,recordId:recordId(machine,number)};draft.attempt=await next(parent);saveAttempt(draft);continue;}
    catch(e){if(e.status!==404)throw e;}
   }
   draft.attempt=number;saveAttempt(draft);
   const payload={schema:1,machine,number,recordId:recordId(machine,number),draftId:draft.id,created:new Date().toISOString()};
   try{
    await request(path+'?@microsoft.graph.conflictBehavior=fail',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    return {number,recordId:payload.recordId};
   }catch(e){if(e.status!==409&&e.status!==412)throw e;}
   // Un conflicto no puede sobreescribir el ID reservado por otro equipo.
  }
  throw new Error('La numeración está ocupada. Vuelve a pulsar Enviar; tus datos se conservan.');
 }
 return {open,next,reserve};
}
scope.CimagrafRegistry={create,machines,recordId};
})(typeof window==='undefined'?module.exports:window);
