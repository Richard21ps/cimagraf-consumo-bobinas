/* Conexión delegada a OneDrive. No guarda contraseñas ni secretos de aplicación. */
(function(){
'use strict';
const CLIENT='8ba1d9b9-a6a9-4917-8df8-31f50262d24e',TENANT='7ea58235-dfc8-4281-88d4-e87d2951c20f';
const REDIRECT='https://richard21ps.github.io/cimagraf-consumo-bobinas/',scopes=['Files.ReadWrite'];
const sharedScopes=[...scopes,'Files.ReadWrite.All'];
let auth,loading;
const operatorIds=new Set(['9ec3e64b3d83e2b691b6a78d544a936e78997ff75e37bb5b9024be3f53bb4b5d', '0980e2c9a65f1f6db7ce217dcacec3aee484f2b4ab81bf782034e67cab988632', 'dfcf2cf97b8e75fb841528e9e80693df4366c2329ea0b5b8a303f6e17b02896c']);
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
const accountId=account=>String(account?.username||'').trim().toLowerCase();
async function allowed(account){
 const username=accountId(account);
 if(!username||account.tenantId&&account.tenantId!==TENANT)return false;
 if(username===accountId({username:window.CimagrafPDFDestination?.owner}))return true;
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(username));
 return operatorIds.has(Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join(''));
}
async function silent(a,account,requestedScopes=scopes){
 try{return await a.acquireTokenSilent({scopes:requestedScopes,account});}
 catch(e){if(!(e instanceof msal.InteractionRequiredAuthError))throw e;return null;}
}
async function verifySession(){
 const a=await init(),account=a.getActiveAccount()||a.getAllAccounts()[0];
 if(!account)return 'signin';
 if(!await allowed(account))return 'denied';
 const result=await silent(a,account);
 return result?.accessToken?'ready':'signin';
}
async function signIn(){
 const a=await init();
 await a.acquireTokenRedirect({scopes,redirectUri:REDIRECT,prompt:'select_account'});
}
async function token(){
 const a=await init(),account=a.getActiveAccount()||a.getAllAccounts()[0];
 if(account){
  if(!await allowed(account))throw Error('Esta cuenta no está habilitada para la calculadora. Vuelve a abrirla e ingresa con una cuenta autorizada.');
  const result=await silent(a,account);
  if(result?.accessToken)return {client:a,account,access:result.accessToken};
 }
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
function sharePointConfig(source){
 const ids=[source?.controlId,...['kirin-1c','kirin-4c'].flatMap(key=>[source?.folders?.[key]?.excel,source?.folders?.[key]?.pdf])];
 if(![source?.driveId,...ids].every(id=>typeof id==='string'&&id.trim()===id&&id.length>0)||new Set(ids).size!==ids.length)
  throw Error('Verifica la biblioteca y las cinco carpetas de destino en SharePoint.');
 return source;
}
async function connect(kind='legacy',machine,target=window.CimagrafSharePointDestination?'sharepoint':'onedrive'){
 if(target!=='onedrive'&&target!=='sharepoint')throw Error('No se reconoce el destino del registro.');
 const sharePoint=target==='sharepoint'?sharePointConfig(window.CimagrafSharePointDestination):null;
 const session=await token();if(!session)return null;
 const fixed=window.CimagrafPDFDestination;
 if(!sharePoint&&(!fixed?.owner||!fixed?.path))throw Error('No está configurada la carpeta de OneDrive.');
 const isOwner=!sharePoint&&accountId(session.account)===accountId({username:fixed.owner});
 try{return await connectWithToken(session.access,fixed,isOwner,kind,machine,sharePoint);}
 catch(error){
  if(isOwner||error.status!==403||String(error.code).toLowerCase()!=='accessdenied')throw error;
  // Connection only looks up folders. No file write has started.
  const shared=await silent(session.client,session.account,sharedScopes);
  if(shared?.accessToken){
   if(shared.accessToken===session.access)throw error;
   return connectWithToken(shared.accessToken,fixed,false,kind,machine,sharePoint);
  }
  status('Microsoft necesita autorización para guardar en las carpetas compartidas. Conservamos el grupo pendiente.');
  await session.client.acquireTokenRedirect({scopes:sharedScopes,account:session.account,redirectUri:REDIRECT});
  return null;
 }
}
async function connectWithToken(access,fixed,isOwner,kind,machine,sharePoint){
 const request=async(path,options={},step=operation(path,options))=>{
  if(!path.startsWith('/')||path.startsWith('//'))throw Error('Ruta de Microsoft no válida.');
  const response=await fetch('https://graph.microsoft.com/v1.0'+path,{...options,signal:AbortSignal.timeout(180000),headers:{Authorization:'Bearer '+access,...options.headers}});
  return decode(response,step);
 };
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
 async function verifiedFolder(path,id,step){
  if(!sharePoint){
   const folder=await ownerFolder(path,step),item=folder.remoteItem||folder;
   if(!item.folder||!item.id||!item.parentReference?.driveId)throw Error('No se encontró la carpeta '+path+'.');
   return {drive:item.parentReference.driveId,id:item.id,name:item.name};
  }
  const item=await request('/drives/'+encodeURIComponent(sharePoint.driveId)+'/items/'+encodeURIComponent(id),{},step);
  if(!item.folder||item.id!==id||item.parentReference?.driveId!==sharePoint.driveId)throw Error('Microsoft no confirmó la carpeta configurada en SharePoint.');
  return {drive:sharePoint.driveId,id:item.id,name:item.name};
 }
 // Upload sessions documentan fail al crear: nunca reemplaza un archivo ya existente.
 async function createFile(parent,name,bytes,contentType){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),size=data.byteLength;
  if(!size||size>=60*1024*1024)throw Error('El archivo debe tener menos de 60 MB para este guardado.');
  const uploadPath=parent+':/'+encodeURIComponent(name)+':/createUploadSession';
  const sessionRequest=item=>request(uploadPath,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item})});
  let session;
  try{session=await sessionRequest({name,'@microsoft.graph.conflictBehavior':'fail'});}
  catch(e){
   // Si Microsoft rechazó la petición antes de crear la sesión, intentar el
   // cuerpo mínimo documentado, manteniendo fail para evitar sobrescrituras.
   if(e.status!==400||String(e.code).toLowerCase()!=='invalidrequest')throw e;
   session=await sessionRequest({'@microsoft.graph.conflictBehavior':'fail'});
  }
  const u=new URL(session.uploadUrl);
  if(u.protocol!=='https:'||!(/(^|\.)sharepoint\.com$|(^|\.)1drv\.com$|(^|\.)onedrive\.com$/.test(u.hostname)))throw Error('Microsoft devolvió una ubicación de carga no válida.');
  const response=await fetch(u.href,{method:'PUT',signal:AbortSignal.timeout(180000),headers:{'Content-Type':contentType,'Content-Range':'bytes 0-'+(size-1)+'/'+size},body:data});
  if(response.status===202)throw Error('La carga quedó incompleta. Reintenta el registro.');
  return decode(response,'Subir el contenido del archivo a OneDrive');
 }
 const controlName=sharePoint?'Control de bobinas de SharePoint':fixed.path;
 const destination=await verifiedFolder(controlName,sharePoint?.controlId,'Abrir la carpeta de control '+controlName);
 const result={destination,request,createFile,target:sharePoint?'sharepoint':'onedrive'};
 if(kind==='excel'||kind==='pdf'){
  const route=window.CimagrafDestinations?.[machine];if(!route)throw Error('Selecciona una máquina válida.');
  const selected=await verifiedFolder(route[kind],sharePoint?.folders[machine][kind],'Abrir la carpeta '+route[kind]);
  result[kind==='excel'?'workbookDestination':'pdfDestination']={drive:selected.drive,id:selected.id};
  result.bookName=route.book;
 }
 return result;
}
window.CimagrafCloud={connect,verifySession,signIn};
})();
