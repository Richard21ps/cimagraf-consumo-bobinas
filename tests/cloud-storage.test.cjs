const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../cloud-storage.js'),'utf8');
const owner='richard.pereyra@cimagraf.com.pe';
const response=(status,body,headers={})=>({ok:status>=200&&status<300,status,json:async()=>structuredClone(body),headers:{get:key=>headers[key]||null}});
const folder=name=>({id:name,folder:{},parentReference:{driveId:'drive-confirmado'}});
function client(handler,username=owner){
 const calls=[],redirects=[];
 class Auth{async initialize(){}async handleRedirectPromise(){return null;}getActiveAccount(){return username?{username}:null;}getAllAccounts(){return [];}async acquireTokenSilent(){return {accessToken:'SOLO-SIMULACION'};}async acquireTokenRedirect(options){redirects.push(options);}}
 const msal={PublicClientApplication:Auth},window={msal,CimagrafPDFDestination:{owner,path:'REGISTRO DE PDF DIGITAL'},CimagrafDestinations:{'kirin-1c':{excel:'BASE DE DATOS KIRIN 1C',pdf:'REGISTRO DE BOBINAS KIRIN 1C',book:'Registro_Kirin_1C.xlsx'}}};
 const context={window,msal,AbortSignal,URL,Uint8Array,TextEncoder,crypto:require('node:crypto').webcrypto,document:{getElementById:()=>({textContent:''})},fetch:async(url,options)=>{calls.push({url,options});return handler(url,options);}};
 vm.createContext(context);vm.runInContext(source,context);return {...window.CimagrafCloud,calls,redirects};
}
test('La ruta por propietario conserva las carpetas configuradas y los destinos independientes',async()=>{
 const f=client(async url=>response(200,folder(url.endsWith('DIGITAL')?'control':'pdf')));
 const c=await f.connect('pdf','kirin-1c');
 assert.equal(c.destination.id,'control');assert.equal(c.pdfDestination.id,'pdf');assert.equal(c.workbookDestination,undefined);
 assert.equal(f.calls.length,2);assert.ok(f.calls[1].url.endsWith('/REGISTRO%20DE%20BOBINAS%20KIRIN%201C'));
 assert.ok(f.calls.every(c=>c.options.headers.Authorization==='Bearer SOLO-SIMULACION'));
});
test('InvalidRequest por UPN del propietario: resuelve su drive y usa ese ID en ambas carpetas',async()=>{
 const f=client(async url=>{
  if(url.includes('/users/'))return response(400,{error:{code:'invalidRequest',message:'Invalid request'}});
  if(url.endsWith('/me/drive?$select=id'))return response(200,{id:'drive-real!'});
  assert.ok(url.startsWith('https://graph.microsoft.com/v1.0/drives/drive-real!/root:/'));
  return response(200,folder(url.endsWith('DIGITAL')?'control':'excel'));
 });
 const c=await f.connect('excel','kirin-1c');assert.equal(c.workbookDestination.id,'excel');
 assert.equal(f.calls.filter(c=>c.url.includes('/users/')).length,1);
 assert.equal(f.calls.filter(c=>c.url.includes('/me/')).length,1);
 assert.equal(c.bookName,'Registro_Kirin_1C.xlsx');
});
test('Otra cuenta no puede cambiar el destino al OneDrive propio cuando falla el del propietario',async()=>{
 const f=client(async()=>response(400,{error:{code:'invalidRequest',message:'Identificador no válido',innerError:{'request-id':'referencia-123'}}}),'kirin.bn@cimagraf.com.pe');
 await assert.rejects(()=>f.connect('pdf','kirin-1c'),e=>{
  assert.equal(e.status,400);assert.equal(e.details.microsoftMessage,'Identificador no válido');assert.equal(e.details.requestId,'referencia-123');
  assert.match(e.details.step,/carpeta de control/);return true;
 });
 assert.equal(f.calls.length,1);assert.ok(!f.calls[0].url.includes('/me/'));
});
test('Permiso denegado: conserva el estado y detalle, sin cambiar cuenta ni reintentar escrituras',async()=>{
 const f=client(async()=>response(403,{error:{code:'accessDenied',message:'Access denied'}},{'request-id':'r-403'}));
 await assert.rejects(()=>f.connect(),e=>e.status===403&&e.details.requestId==='r-403'&&/permiso/.test(e.message));assert.equal(f.calls.length,1);
});
test('Si también falla la ruta por ID, conserva el mensaje exacto y el paso de Microsoft',async()=>{
 const f=client(async url=>url.includes('/me/drive?')?response(200,{id:'drive-real'}):response(400,{error:{code:'invalidRequest',message:'ObjectHandle is Invalid'}}));
 await assert.rejects(()=>f.connect(),e=>e.details.microsoftMessage==='ObjectHandle is Invalid'&&e.details.step==='Abrir la carpeta de control REGISTRO DE PDF DIGITAL');
 assert.equal(f.calls.length,3);assert.ok(f.calls.every(c=>!c.options.method||c.options.method==='GET'));
});
test('La carga usa fail y no envía Authorization a la URL preautorizada; el error oculta credenciales',async()=>{
 let session=false,uploaded=false;
 const f=client(async(url,options)=>{
  if(url.endsWith('/createUploadSession')){session=true;const b=JSON.parse(options.body);assert.equal(b.item['@microsoft.graph.conflictBehavior'],'fail');return response(200,{uploadUrl:'https://empresa.sharepoint.com/upload?token=PRIVADO'});}
  if(url.includes('/upload?')){uploaded=true;assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers['Content-Range'],'bytes 0-2/3');return response(400,{error:{code:'invalidRequest',message:'Falla en https://empresa.sharepoint.com/upload?token=PRIVADO Bearer PRIVADO'}});}
  return response(200,folder('control'));
 });
 const c=await f.connect();
 await assert.rejects(()=>c.createFile('/drives/d/items/i','OP - Kirin 1C.pdf',new Uint8Array([1,2,3]),'application/pdf'),e=>{
  assert.equal(e.details.step,'Subir el contenido del archivo a OneDrive');assert.ok(!JSON.stringify(e.details).includes('PRIVADO'));return true;
 });assert.ok(session&&uploaded);
});

test('Una sesión rechazada con invalidRequest se reintenta sin nombre duplicado y sin sobrescribir',async()=>{
 let sessions=0;
 const f=client(async(url,options)=>{
  if(url.endsWith('/createUploadSession')){const item=JSON.parse(options.body).item;sessions++;assert.equal(item['@microsoft.graph.conflictBehavior'],'fail');if(sessions===1){assert.equal(item.name,'test.pdf');return response(400,{error:{code:'invalidRequest'}});}assert.equal(item.name,undefined);return response(200,{uploadUrl:'https://empresa.sharepoint.com/upload?token=TEMP'});}
  if(url.includes('/upload?'))return response(201,{id:'archivo',size:3});
  return response(200,folder('control'));
 });
 const c=await f.connect();const file=await c.createFile('/drives/d/items/i','test.pdf',new Uint8Array([1,2,3]),'application/pdf');
 assert.equal(file.id,'archivo');assert.equal(sessions,2);
});
test('No se reintenta la sesión si Microsoft no confirma un error 400',async()=>{
 let sessions=0;const f=client(async(url)=>{if(url.endsWith('/createUploadSession')){sessions++;return response(503,{error:{code:'serviceUnavailable'}});}return response(200,folder('control'));});
 const c=await f.connect();await assert.rejects(()=>c.createFile('/drives/d/items/i','test.pdf',new Uint8Array([1]),'application/pdf'));assert.equal(sessions,1);
});

test('Las dos cuentas Kirin y el propietario abren el editor sin tocar OneDrive',async()=>{
 for(const username of [owner,'KIRIN.COLOR@CIMAGRAF.COM.PE','kirin.bn@cimagraf.com.pe']){
  const f=client(()=>{throw Error('No toca OneDrive');},username);
  assert.equal(await f.verifySession(),'ready');assert.equal(f.calls.length,0);
 }
});
test('Una cuenta no autorizada no entra ni guarda; el botón permite elegir otra',async()=>{
 const f=client(()=>{throw Error('No toca OneDrive');},'otro@cimagraf.com.pe');
 assert.equal(await f.verifySession(),'denied');
 await assert.rejects(()=>f.connect(),/no está habilitada/);
 await f.signIn();assert.equal(f.redirects[0].prompt,'select_account');assert.equal(f.calls.length,0);
 assert.equal(await client(()=>{},'').verifySession(),'signin');
});
