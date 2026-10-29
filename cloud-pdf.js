/* CIMAGRAF: PDF directo a OneDrive. No usa Power Automate ni secretos de cliente. */
(function(){
'use strict';
const CLIENT='8ba1d9b9-a6a9-4917-8df8-31f50262d24e';
const TENANT='7ea58235-dfc8-4281-88d4-e87d2951c20f';
const REDIRECT='https://richard21ps.github.io/cimagraf-consumo-bobinas/';
const PENDING='cimagraf-pdf-pending-v1',TARGET='cimagraf-pdf-folder-v1';
const scopes=['Files.ReadWrite'];
const $=id=>document.getElementById(id);
let auth,job,busy=false;
const status=$('cloud-pdf-status');
function report(text,error=false){status.textContent=text;status.classList.toggle('cloud-error',error);$('forms-cloud-status').textContent=text;$('forms-cloud-status').classList.toggle('cloud-error',error);}
function script(src,globalName){return new Promise((resolve,reject)=>{if(window[globalName])return resolve();const el=document.createElement('script');el.src=src;el.integrity=src.includes('msal-browser')?'sha384-dzOMecW+tQeM+pH4bitTcEtSsfZE54pSeogsBeGqCoTt2TnO/Gkuo9xuaQdUNcNg':'sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3';el.crossOrigin='anonymous';el.onload=resolve;el.onerror=()=>{el.remove();reject(new Error('No se pudo cargar la conexión. Revisa Internet e inténtalo otra vez.'));};document.head.append(el);});}
async function initAuth(){
 if(auth)return auth;
 await script('https://cdn.jsdelivr.net/npm/@azure/msal-browser@5.27.0/lib/msal-browser.min.js','msal');
 const instance=new msal.PublicClientApplication({auth:{clientId:CLIENT,authority:'https://login.microsoftonline.com/'+TENANT,redirectUri:REDIRECT,navigateToLoginRequestUrl:false},cache:{cacheLocation:'sessionStorage'}});
 await instance.initialize();
 const response=await instance.handleRedirectPromise();if(response?.account)instance.setActiveAccount(response.account);
 auth=instance;return instance;
}
async function token(){
 const a=await initAuth(),account=a.getActiveAccount()||a.getAllAccounts()[0];
 if(account){try{return (await a.acquireTokenSilent({scopes,account})).accessToken;}catch(e){if(!(e instanceof msal.InteractionRequiredAuthError))throw e;}}
 report('Microsoft abrirá el inicio de sesión en esta misma pestaña. Tu trabajo queda conservado.');
 await a.acquireTokenRedirect({scopes,account,redirectUri:REDIRECT});
 return null;
}
async function graph(path,access,options={}){
 const response=await fetch('https://graph.microsoft.com/v1.0'+path,{...options,headers:{Authorization:'Bearer '+access,...options.headers}});
 if(!response.ok){const error=await response.json().catch(()=>({}));const code=error.error?.code;
  if(response.status===403)throw new Error('La cuenta no tiene permiso para guardar en esta carpeta. Solicita acceso de edición.');
  if(response.status===401)throw new Error('La sesión de Microsoft venció. Vuelve a intentar el guardado.');
  if(response.status===404)throw new Error('No se encuentra la carpeta configurada. Revisa el vínculo.');
  if(response.status===429)throw new Error('OneDrive está ocupado. Espera un momento y vuelve a intentar.');
  throw new Error('OneDrive no confirmó el guardado'+(code?' ('+code+')':'')+'. Puedes reintentar sin enviar Forms otra vez.');
 }
 return response.json();
}
function folderLink(value){const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='grupocimagraf-my.sharepoint.com'||!u.pathname.startsWith('/:f:/'))throw new Error('Usa el vínculo de la carpeta de OneDrive de Cimagraf.');return u.href;}
function shareId(value){return 'u!'+btoa(unescape(encodeURIComponent(value))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function configuredDestination(){
 const fixed=window.CimagrafPDFDestination;
 if(typeof fixed?.driveId==='string'&&fixed.driveId.trim()&&typeof fixed?.folderId==='string'&&fixed.folderId.trim())return {drive:fixed.driveId.trim(),id:fixed.folderId.trim()};
 try{const local=JSON.parse(localStorage.getItem(TARGET)||'null');return typeof local?.drive==='string'&&local.drive&&typeof local?.id==='string'&&local.id?local:null;}catch(_){return null;}
}
async function target(access){
 const configured=configuredDestination();
 if(configured?.drive&&configured?.id)return configured;
 const link=folderLink($('cloud-folder-url').value.trim());
 const item=await graph('/shares/'+shareId(link)+'/driveItem',access);
 const folder=item.remoteItem||item;
 if(!folder.folder||!folder.id||!folder.parentReference?.driveId)throw new Error('El vínculo debe apuntar a una carpeta, no a un archivo.');
 const result={drive:folder.parentReference.driveId,id:folder.id,name:folder.name};
 localStorage.setItem(TARGET,JSON.stringify(result));$('cloud-folder-url').value='';$('cloud-folder-setup').open=false;
 return result;
}
const number=v=>new Intl.NumberFormat('es-PE',{minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(v)||0);
async function pdf(r,created){
 await script('https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js','jspdf');
 const doc=new jspdf.jsPDF({unit:'mm',format:'a4'});let y=18;
 const text=(value,bold=false,size=10)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);const lines=doc.splitTextToSize(String(value),180);for(const line of lines){if(y>275){doc.addPage();y=18;}doc.text(line,15,y);y+=5;}y+=2;};
 const heading=value=>{y+=4;text(value,true,12);};
 const logo=document.querySelector('.brand-logo');if(logo?.src.startsWith('data:image/png'))doc.addImage(logo.src,'PNG',143,10,52,15.6);
 doc.setTextColor(20,91,131);text('CIMAGRAF · ÁREA DIGITAL',true,11);y=34;
 text('Consumo y devolución de bobinas',true,17);
 doc.setTextColor(35,45,55);
 text('Grupo: '+r.group+' · '+new Date(created).toLocaleString('es-PE',{timeZone:'America/Lima'}));
 text('Material: '+r.paper+' · Gramaje: '+number(r.gsm)+' g/m²',true);
 text('Anchos: '+r.usedRolls.map(b=>b.id+': '+number(b.width)+' mm').join(' | '));
 heading('Producción por OP');
 r.sourceOps.forEach((o,i)=>{text('OP '+o.id,true);text(o.books+' libros · '+o.copies+' copias/libro · Avance '+number(o.advance)+' mm');text(number(r.sums[i].metros)+' m · '+number(r.sums[i].kg)+' kg');});
 heading('Consumo por OP y bobina');
 r.details.forEach(d=>text('OP '+d.op+' | '+d.bobina+' | '+number(d.ancho)+' mm | Producción '+number(d.kg)+' kg | Saldo tras OP '+number(d.saldo)+' kg'));
 text('Los saldos tras cada OP son parciales y no se suman.',false,9);
 heading('Saldo final por bobina');
 r.usedRolls.forEach(b=>{text(b.id+' · '+number(b.width)+' mm'+(b.left<=0.000001?' · AGOTADA':''),true);text('Inicial '+number(b.initial)+' kg | Producción '+number(b.used)+' kg');text('Lonjas '+number(b.retired)+' kg | Sobrante neto '+number(b.corePaper)+' kg | Devolver '+number(b.left)+' kg');if(b.retired>0){text('Motivo: '+((b.problems||[]).join('; ')||'Sin indicar'));text('Áreas: '+((b.areas||[]).join('; ')||'Sin indicar'));}});
 heading('ENTREGAR AL ALMACÉN: '+number(r.saldo)+' kg');
 text('Pesos netos de papel, sin cartón. Lonjas y sobrante neto se descuentan una sola vez.',false,9);
 text('Resumen generado al abrir Forms. Este PDF no acredita el envío del formulario.',false,9);
 return doc.output('arraybuffer');
}
function filename(j){
 const ops=j.snapshot.result.sourceOps.map(o=>String(o.id).replace(/[^a-zA-Z0-9_-]/g,'_')).join('_').slice(0,100)||'SIN_OP';
 const date=new Date(j.created).toLocaleString('sv-SE',{timeZone:'America/Lima'}).replace(/[^0-9]/g,'');
 return 'OP_'+ops+'_'+date+'_'+j.id.slice(0,8)+'.pdf';
}
function finish(){
 if(busy){report('Espera a que termine el guardado del PDF.');return;}
 if(!job?.saved){report('El PDF todavía no está guardado. Reintenta antes de continuar.',true);return;}
 sessionStorage.removeItem(PENDING);job=null;$('multi-root').inert=false;
 window.CimagrafArchive.reset();report('Grupo terminado. PDF guardado en OneDrive.');
}
function remember(){$('multi-root').inert=true;sessionStorage.setItem(PENDING,JSON.stringify(job));}
function recover(){try{const saved=JSON.parse(sessionStorage.getItem(PENDING)||'null');if(saved?.snapshot?.result&&saved.id&&saved.created){job=saved;$('multi-root').inert=true;window.CimagrafArchive.restore(saved.snapshot);window.CimagrafArchive.resume(saved.snapshot);report(saved.saved?'PDF guardado. Completa Forms y confirma su envío para continuar.':'Hay un PDF pendiente. Usa «Reintentar guardar PDF»; no envíes Forms otra vez si ya lo enviaste.');$('cloud-retry').hidden=!!saved.saved;$('forms-next').textContent='Ya envié · Siguiente grupo';}}catch(_){report('No se pudo recuperar el guardado pendiente.',true);}}
async function save(){
 if(busy||!job||job.saved)return;
 busy=true;$('forms-next').disabled=true;$('cloud-retry').disabled=true;$('forms-back').disabled=true;
 try{
  const configured=configuredDestination();
  if(!configured&&!$('cloud-folder-url').value.trim()){$('forms-modal').classList.add('open');document.body.classList.add('forms-open');$('cloud-folder-setup').open=true;$('cloud-folder-url').focus();throw new Error('Configura la carpeta de OneDrive una sola vez en este equipo.');}
  // La URL de carpeta queda únicamente en la sesión durante el inicio de sesión.
  if($('cloud-folder-url').value.trim())sessionStorage.setItem('cimagraf-pdf-folder-link',folderLink($('cloud-folder-url').value.trim()));
  remember();report('Conectando con Microsoft…');
  const access=await token();if(!access)return;
  const folder=await target(access);report('Generando y guardando PDF…');
  const bytes=await pdf(job.snapshot.result,job.created);
  const item=await graph('/drives/'+encodeURIComponent(folder.drive)+'/items/'+encodeURIComponent(folder.id)+':/'+encodeURIComponent(filename(job))+':/content',access,{method:'PUT',headers:{'Content-Type':'application/pdf'},body:bytes});
  if(!item.id||Number(item.size)!==bytes.byteLength)throw new Error('OneDrive no confirmó el archivo completo. Reintenta el guardado.');
  job.saved=true;remember();sessionStorage.removeItem('cimagraf-pdf-folder-link');
  const link=$('cloud-last-pdf');if(item.webUrl){const u=new URL(item.webUrl);if(u.protocol==='https:'&&u.hostname.endsWith('.sharepoint.com')){link.href=u.href;link.hidden=false;}}
  $('cloud-retry').hidden=true;report('PDF guardado en OneDrive. Completa Forms y espera su confirmación antes de pasar al siguiente grupo.');
 }catch(e){report(e.message||'No se pudo guardar el PDF. Los datos se conservan.',true);$('cloud-retry').hidden=false;}
 finally{busy=false;$('forms-next').textContent='Ya envié · Siguiente grupo';$('forms-next').disabled=false;$('cloud-retry').disabled=false;$('forms-back').disabled=false;}
}
$('multi-register').addEventListener('click',()=>{if(!$('forms-modal').classList.contains('open'))return;job={id:crypto.randomUUID(),created:new Date().toISOString(),snapshot:window.CimagrafArchive.snapshot()};remember();$('forms-next').textContent='Guardando PDF…';save();});
document.addEventListener('click',e=>{if(e.target.closest('#multi-register')&&sessionStorage.getItem(PENDING)){e.preventDefault();e.stopImmediatePropagation();report('Guarda primero el PDF pendiente. No vuelvas a enviar Forms.',true);if(job)window.CimagrafArchive.resume(job.snapshot);return;}if(!e.target.closest('#forms-next'))return;e.preventDefault();e.stopImmediatePropagation();if(!job){report('No hay un resumen preparado para guardar.',true);return;}if(job.saved)finish();else save();},true);
$('cloud-retry').addEventListener('click',save);
$('cloud-folder-export').addEventListener('click',()=>{
 const folder=configuredDestination();
 if(!folder){report('Todavía no hay una carpeta conectada en este navegador. Abre este apartado en el equipo donde ya se guardó el PDF.',true);return;}
 const output=$('cloud-folder-identifiers');
 output.value=JSON.stringify({driveId:folder.drive,folderId:folder.id});output.hidden=false;output.focus();output.select();
});
if(window.CimagrafPDFDestination?.driveId&&window.CimagrafPDFDestination?.folderId){$('cloud-folder-setup').hidden=true;}
$('cloud-change-folder').addEventListener('click',()=>{localStorage.removeItem(TARGET);$('cloud-folder-setup').open=true;report('Pega el vínculo de la carpeta y reintenta guardar.');});
try{const link=sessionStorage.getItem('cimagraf-pdf-folder-link');if(link)$('cloud-folder-url').value=link;}catch(_){}
recover();
if(job&&(location.hash.includes('code=')||location.search.includes('code=')||location.hash.includes('error='))){initAuth().then(save).catch(e=>report('No se completó el inicio de sesión: '+e.message,true));}
})();
