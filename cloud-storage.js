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
async function decode(response){
 if(!response.ok){
  const body=await response.json().catch(()=>({})),code=body.error?.innerError?.code||body.error?.code||'';
  const message=response.status===403?'La cuenta no tiene permiso de edición en la carpeta o en el Excel.':
   response.status===401?'La sesión de Microsoft venció. Vuelve a iniciar sesión.':
   [409,423].includes(response.status)?'El archivo está ocupado. Cierra su edición y reintenta.':
   response.status===429?'Microsoft está ocupado. Espera un momento y reintenta.':
   'Microsoft no confirmó la operación'+(code?' ('+code+')':'')+'. Reintenta el mismo registro.';
  throw Object.assign(Error(message),{status:response.status,code,retryAfter:response.headers.get('Retry-After')});
 }
 if(response.status===204)return null;
 return response.json();
}
async function connect(){
 const access=await token();if(!access)return null;
 const request=async(path,options={})=>{
  if(!path.startsWith('/')||path.startsWith('//'))throw Error('Ruta de Microsoft no válida.');
  const response=await fetch('https://graph.microsoft.com/v1.0'+path,{...options,signal:AbortSignal.timeout(180000),headers:{Authorization:'Bearer '+access,...options.headers}});
  return decode(response);
 };
 const fixed=window.CimagrafPDFDestination;
 if(!fixed?.owner||!fixed?.path)throw Error('No está configurada la carpeta de OneDrive.');
 const endpoint='/users/'+encodeURIComponent(fixed.owner)+'/drive/root:/'+fixed.path.split('/').map(encodeURIComponent).join('/');
 const folder=await request(endpoint),item=folder.remoteItem||folder;
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
  return decode(response);
 }
 const destination={drive:item.parentReference.driveId,id:item.id,name:item.name};
 return {destination,request,createFile};
}
window.CimagrafCloud={connect};
})();
