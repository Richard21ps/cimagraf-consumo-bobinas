/* Conexión delegada a OneDrive. No guarda contraseñas ni secretos de aplicación. */
(function(){
'use strict';
const CLIENT='8ba1d9b9-a6a9-4917-8df8-31f50262d24e',TENANT='7ea58235-dfc8-4281-88d4-e87d2951c20f';
const REDIRECT='https://richard21ps.github.io/cimagraf-consumo-bobinas/',scopes=['Files.ReadWrite'];
let auth,loading;
const status=text=>{document.getElementById('cloud-status').textContent=text;};
function library(){return new Promise((resolve,reject)=>{
 if(window.msal){resolve();return;}
 const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@azure/msal-browser@5.27.0/lib/msal-browser.min.js';
 s.integrity='sha384-dzOMecW+tQeM+pH4bitTcEtSsfZE54pSeogsBeGqCoTt2TnO/Gkuo9xuaQdUNcNg';s.crossOrigin='anonymous';
 s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('No se pudo cargar la conexión con Microsoft. Revisa Internet y reintenta.'));};document.head.append(s);
});}
async function init(){
 if(auth)return auth;if(loading)return loading;
 loading=(async()=>{
  await library();
  const a=new msal.PublicClientApplication({auth:{clientId:CLIENT,authority:'https://login.microsoftonline.com/'+TENANT,redirectUri:REDIRECT,navigateToLoginRequestUrl:false},cache:{cacheLocation:'sessionStorage'}});
  await a.initialize();const returned=await a.handleRedirectPromise();if(returned?.account)a.setActiveAccount(returned.account);
  auth=a;return a;
 })();
 try{return await loading;}finally{loading=null;}
}
async function token(){
 const a=await init(),account=a.getActiveAccount()||a.getAllAccounts()[0];
 if(account){try{return (await a.acquireTokenSilent({scopes,account})).accessToken;}catch(e){if(!(e instanceof msal.InteractionRequiredAuthError))throw e;}}
 status('Inicia sesión con la cuenta corporativa. El grupo queda conservado en este equipo.');
 await a.acquireTokenRedirect({scopes,account,redirectUri:REDIRECT});return null;
}
const safeDetail=value=>String(value||'').replace(/Bearer\s+\S+/gi,'[credencial omitida]').replace(/https?:\/\/[^\s"<>]+/gi,'[dirección omitida]').slice(0,1200);
function operation(path,options){
 if(path.includes('/createUploadSession'))return 'Preparar la carga del archivo';
 if(path.includes('/workbook/'))return options.method==='PATCH'?'Escribir los datos en Excel':'Abrir o comprobar el Excel';
 if(path.endsWith('/children')&&options.method==='POST')return 'Preparar una carpeta de control';
 if(options.method==='DELETE')return 'Liberar el turno de guardado';
 return 'Consultar archivos y control de OneDrive';
}
async function decode(response,step){
 if(!response.ok){
  const body=await response.json().catch(()=>({})),code=body.error?.code||body.error?.innerError?.code||'';
  const message=response.status===403?'La cuenta no tiene permiso de edición en la carpeta o en el Excel.':
   response.status===401?'La sesión de Microsoft venció. Vuelve a iniciar sesión.':
   [409,423].includes(response.status)?'El archivo está ocupado. Cierra su edición y reintenta.':
   response.status===429?'Microsoft está ocupado. Espera un momento y reintenta.':
   'Microsoft no confirmó la operación'+(code?' ('+code+')':'')+'. Reintenta el mismo registro.';
  const details={step,status:response.status,code:safeDetail(code),microsoftMessage:safeDetail(body.error?.message),requestId:safeDetail(response.headers.get('request-id')||body.error?.innerError?.['request-id']||body.error?.innererror?.['request-id'])};
  throw Object.assign(Error(message),{status:response.status,code,retryAfter:response.headers.get('Retry-After'),details});
 }
 if(response.status===204)return null;
 return response.json();
}
async function connect(kind='legacy',machine){
 const access=await token();if(!access)return null;
 const request=async(path,options={},step=operation(path,options))=>{
  if(!path.startsWith('/')||path.startsWith('//'))throw Error('Ruta de Microsoft no válida.');
  const response=await fetch('https://graph.microsoft.com/v1.0'+path,{...options,signal:AbortSignal.timeout(180000),headers:{Authorization:'Bearer '+access,...options.headers}});
  return decode(response,step);
 };
 const fixed=window.CimagrafPDFDestination;
 if(!fixed?.owner||!fixed?.path)throw Error('No está configurada la carpeta de OneDrive.');
 const account=auth.getActiveAccount()||auth.getAllAccounts()[0];
 const isOwner=String(account?.username||'').toLowerCase()===fixed.owner.toLowerCase();
 let ownerDrive;
 async function ownerFolder(path,step){
  const encoded=path.split('/').map(encodeURIComponent).join('/');
  const endpoint=()=>ownerDrive?'/drives/'+encodeURIComponent(ownerDrive)+'/root:/'+encoded:'/users/'+encodeURIComponent(fixed.owner)+'/drive/root:/'+encoded;
  try{return await request(endpoint(),{},step);}catch(e){
   // Solo el propietario confirmado puede usar /me: nunca cambia el destino a otra cuenta.
   // Algunos OneDrive rechazan la ruta por UPN; resolver su drive permite usar su ID real.
   if(ownerDrive||!isOwner||e.status!==400||String(e.code).toLowerCase()!=='invalidrequest')throw e;
   const drive=await request('/me/drive?$select=id',{},'Identificar el OneDrive del propietario');
   if(!drive.id||typeof drive.id!=='string')throw Error('Microsoft no devolvió el identificador de OneDrive.');
   ownerDrive=drive.id;
   return request(endpoint(),{},step);
  }
 }
 const folder=await ownerFolder(fixed.path,'Abrir la carpeta de control '+fixed.path),item=folder.remoteItem||folder;
 if(!item.folder||!item.id||!item.parentReference?.driveId)throw Error('No se encontró la carpeta del registro.');
 // Upload sessions documentan fail al crear: nunca reemplaza un archivo ya existente.
 async function createFile(parent,name,bytes,contentType){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),size=data.byteLength;
  if(!size||size>=60*1024*1024)throw Error('El archivo debe tener menos de 60 MB para este guardado.');
  const session=await request(parent+':/'+encodeURIComponent(name)+':/createUploadSession',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item:{name,'@microsoft.graph.conflictBehavior':'fail'}})});
  const u=new URL(session.uploadUrl);
  if(u.protocol!=='https:'||!(/(^|\.)sharepoint\.com$|(^|\.)1drv\.com$|(^|\.)onedrive\.com$/.test(u.hostname)))throw Error('Microsoft devolvió una ubicación de carga no válida.');
  const response=await fetch(u.href,{method:'PUT',signal:AbortSignal.timeout(180000),headers:{'Content-Type':contentType,'Content-Range':'bytes 0-'+(size-1)+'/'+size},body:data});
  if(response.status===202)throw Error('La carga quedó incompleta. Reintenta el registro.');
  return decode(response,'Subir el contenido del archivo a OneDrive');
 }
 const destination={drive:item.parentReference.driveId,id:item.id,name:item.name};
 const result={destination,request,createFile};
 if(kind==='excel'||kind==='pdf'){
  const route=window.CimagrafDestinations?.[machine];if(!route)throw Error('Selecciona una máquina válida.');
  const selected=await ownerFolder(route[kind],'Abrir la carpeta '+route[kind]);
  const target=selected.remoteItem||selected;
  if(!target.folder||!target.id||!target.parentReference?.driveId)throw Error('No se encontró la carpeta '+route[kind]+'.');
  result[kind==='excel'?'workbookDestination':'pdfDestination']={drive:target.parentReference.driveId,id:target.id};
  result.bookName=route.book;
 }
 return result;
}
window.CimagrafCloud={connect};
})();
