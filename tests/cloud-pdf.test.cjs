const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const uploads=f=>f.calls.filter(c=>c.options.headers?.['Content-Type']==='application/pdf');
const code=fs.readFileSync(require('node:path').join(__dirname,'../cloud-pdf.js'),'utf8');
function fixture({fail=false,pending=null}={}){
 const elements={},listeners=new Map();const el=id=>elements[id]??=( {value:'',classList:{toggle(){},add(){},contains(){return true;}},addEventListener:(event,fn)=>listeners.set(id+event,fn),focus(){},select(){},hidden:false,disabled:false});
 const session=new Map(pending?[['cimagraf-pdf-pending-v1',JSON.stringify(pending)]]:[]),local=new Map([['cimagraf-pdf-folder-v1',JSON.stringify({drive:'drive',id:'folder'})]]);
 const storage=m=>({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)});
 let resets=0,restores=0,resumes=0;const calls=[],printed=[],render={},folders=new Map();
 const html2pdf=()=>({set(options){render.options=options;return this;},from(el){render.html=el.innerHTML;render.className=el.className;return this;},toPdf(){return this;},async outputPdf(type){render.type=type;return new ArrayBuffer(123);}});
 const r={machine:'Kirin 1C',machineKey:'kirin-1c',group:'01/02',paper:'Bond',gsm:90,saldo:178.63,sourceOps:[{id:'OP1',books:1000,copies:20,advance:240}],sums:[{metros:4800,kg:207.36}],details:[{op:'OP1',bobina:'Bobina 1',ancho:480,kg:207.36,saldo:178.63}],usedRolls:[{id:'Bobina 1',width:480,initial:400,used:207.36,retired:5,corePaper:9.01,left:178.63,problems:['Daño'],areas:['Almacén']}]};
 const draft={result:r,ops:r.sourceOps,rolls:[{id:'Bobina 1',kg:400,width:480,scrap:5}],group:'01/02',paper:'Bond',gsm:'90'};
 class Auth{async initialize(){}async handleRedirectPromise(){}getActiveAccount(){return {username:'test'};}async acquireTokenSilent(){return {accessToken:'test-token'};}}
 class Doc{setFont(){}setFontSize(){}splitTextToSize(v){return [v];}text(v){printed.push(v);}setTextColor(){}addPage(){}output(){return new ArrayBuffer(123);}}
 const context={window:{html2pdf,msal:{PublicClientApplication:Auth},jspdf:{jsPDF:Doc},CimagrafArchive:{reportHTML:r=>'<header>Plantilla compartida</header><table><tr><td>'+r.saldo+'</td><td>'+r.usedRolls[0].areas.join('; ')+'</td></tr></table>',snapshot:()=>JSON.parse(JSON.stringify(draft)),restore:()=>restores++,resume:()=>resumes++,reset:()=>resets++}},html2pdf,document:{createElement:()=>({className:'',innerHTML:'',querySelectorAll:()=>[]}),body:{classList:{add(){}}},getElementById:el,querySelector:()=>null,addEventListener:(event,fn)=>listeners.set('document'+event,fn),head:{append(){throw new Error('Unexpected remote dependency');}}},msal:{PublicClientApplication:Auth},jspdf:{jsPDF:Doc},sessionStorage:storage(session),localStorage:storage(local),URL,Intl,Date,ArrayBuffer,encodeURIComponent,unescape,btoa:s=>Buffer.from(s,'binary').toString('base64'),location:{hash:'',search:''},crypto:require('node:crypto').webcrypto,fetch:async(url,options)=>{
  calls.push({url,options});
  const path=new URL(url).pathname;
  const response=(status,item)=>({ok:status>=200&&status<300,status,json:async()=>item});
  if(fail)return response(403,{error:{code:'accessDenied'}});
  if(options.method==='POST'){
   const body=JSON.parse(options.body),key=path.slice(0,-9)+':/'+encodeURIComponent(body.name);
   assert.equal(body['@microsoft.graph.conflictBehavior'],'fail');
   if(folders.has(key))return response(409,{error:{code:'nameAlreadyExists'}});
   const item={id:'folder-'+body.name,name:body.name,folder:{}};
   folders.set(key,item);return response(201,item);
  }
  if(!options.method&&path.includes('/items/'))return folders.has(path)?response(200,folders.get(path)):response(404,{});
  if(!options.method)return response(200,{id:'fixed-folder',folder:{},parentReference:{driveId:'fixed-drive'}});
  return response(200,{id:'uploaded',size:123,webUrl:'https://grupocimagraf-my.sharepoint.com/pdf'});
 }};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../report-pdf.js'),'utf8'),context);vm.runInContext(code.replace(/\}\)\(\);\s*$/, 'window.testCloud={save,finish,configuredDestination,folderLink,shareId,filename,pdf,setJob:j=>job=j};})();'),context);
 return {context,el,session,local,listeners,calls,printed,render,r,draft,api:context.window.testCloud,get resets(){return resets;},get restores(){return restores;},get resumes(){return resumes;}};
}
(async()=>{
 let f=fixture(),j={id:'uuid',created:'2026-10-29T03:00:00Z',snapshot:{result:f.r}};
 assert.equal(f.api.filename(j),'OP_OP1_20261028220000_uuid.pdf');
 assert.throws(()=>f.api.folderLink('https://evil.example/:f:/foo'));
 assert.throws(()=>f.api.folderLink('http://grupocimagraf-my.sharepoint.com/:f:/foo'));
 f.api.setJob(j);await f.api.save();assert.equal(f.resets,0);assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.method,'PUT');assert.equal(f.calls[0].options.headers['Content-Type'],'application/pdf');assert.equal(f.render.html,f.context.window.CimagrafArchive.reportHTML(f.r));assert.equal(f.render.className,'cimagraf-report');assert.equal(f.render.options.margin,12);assert.equal(f.render.options.jsPDF.format,'a4');assert.ok(f.render.options.pagebreak.avoid.includes('tr'));assert.equal(f.render.type,'arraybuffer');assert.equal(JSON.parse(f.session.get('cimagraf-pdf-pending-v1')).saved,true);await f.api.save();assert.equal(f.calls.length,1);f.api.finish();assert.equal(f.resets,1);assert.equal(f.session.has('cimagraf-pdf-pending-v1'),false);
 f=fixture({fail:true});j={...j,saved:false,snapshot:{result:f.r}};f.api.setJob(j);await f.api.save();assert.equal(f.resets,0);assert.equal(f.el('multi-root').inert,true);assert.ok(f.session.has('cimagraf-pdf-pending-v1'));await f.api.save();assert.equal(f.calls[0].url,f.calls[1].url);assert.equal(f.el('forms-next').disabled,false);
 f=fixture({pending:j});assert.equal(f.restores,1);assert.equal(f.el('multi-root').inert,true);assert.equal(f.el('cloud-retry').hidden,false);
 f=fixture();f.local.clear();f.api.setJob(j);await f.api.save();assert.equal(f.calls.length,0);assert.equal(f.resets,0);assert.equal(f.el('cloud-folder-setup').open,true);
 f=fixture();f.context.window.CimagrafPDFDestination={driveId:'shared-drive',folderId:'shared-folder'};f.local.clear();assert.equal(f.api.configuredDestination().drive,'shared-drive');f.api.setJob({...j,saved:false,snapshot:{result:f.r}});await f.api.save();assert.ok(f.calls[0].url.includes('/drives/shared-drive/items/shared-folder:'));assert.equal(f.calls.length,1);
 f=fixture();f.local.set('cimagraf-pdf-folder-v1','invalid');assert.equal(f.api.configuredDestination(),null);
 f=fixture();f.listeners.get('cloud-folder-exportclick')();assert.deepEqual(JSON.parse(f.el('cloud-folder-identifiers').value),{driveId:'drive',folderId:'folder'});
 f=fixture();f.context.window.CimagrafPDFDestination={owner:'richard.pereyra@cimagraf.com.pe',path:'REGISTRO DE PDF DIGITAL'};f.local.clear();f.api.setJob({...j,saved:false,snapshot:{result:f.r}});await f.api.save();assert.equal(f.calls.length,2);assert.equal(f.calls[0].url,'https://graph.microsoft.com/v1.0/users/richard.pereyra%40cimagraf.com.pe/drive/root:/REGISTRO%20DE%20PDF%20DIGITAL');assert.ok(f.calls[1].url.includes('/drives/fixed-drive/items/fixed-folder:'));assert.equal(f.el('cloud-folder-setup').open,false);assert.equal(JSON.parse(f.session.get('cimagraf-pdf-pending-v1')).saved,true);
 f=fixture();f.context.window.CimagrafPDFDestination={owner:'richard.pereyra@cimagraf.com.pe',path:'REGISTRO DE PDF DIGITAL'};f.local.set('cimagraf-pdf-folder-v1',JSON.stringify({drive:'wrong',id:'wrong'}));assert.equal(f.api.configuredDestination().owner,'richard.pereyra@cimagraf.com.pe');
 f=fixture({fail:true});f.context.window.CimagrafPDFDestination={owner:'richard.pereyra@cimagraf.com.pe',path:'REGISTRO DE PDF DIGITAL'};f.local.clear();f.api.setJob({...j,saved:false,snapshot:{result:f.r}});await f.api.save();assert.equal(f.calls.length,1);assert.equal(f.resets,0);assert.equal(f.el('cloud-folder-setup').open,undefined);
 f=fixture();f.listeners.get('multi-registerclick')();for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(uploads(f).length,1);assert.equal(f.resets,0);assert.equal(JSON.parse(f.session.get('cimagraf-pdf-pending-v1')).saved,true);
 // Regresión: volver desde Forms debe liberar los campos sin borrar el grupo.
 const settle=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
 const registerEvent=()=>({target:{closest:s=>s==='#multi-register'},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}});
 f=fixture();f.listeners.get('multi-registerclick')();await settle();
 const archived=JSON.parse(f.session.get('cimagraf-pdf-pending-v1'));
 f.listeners.get('forms-backclick')();assert.equal(f.el('multi-root').inert,false);assert.equal(f.resets,0);assert.equal(f.draft.ops[0].id,'OP1');
 // Sin cambios: retoma el mismo registro y conserva un solo archivo.
 let event=registerEvent();f.listeners.get('documentclick')(event);await settle();
 assert.equal(event.prevented,true);assert.equal(f.resumes,1);assert.equal(uploads(f).length,1);assert.equal(f.el('multi-root').inert,true);
 assert.equal(JSON.parse(f.session.get('cimagraf-pdf-pending-v1')).id,archived.id);
 // Con cambios: deja que el motor valide y que prepare Forms/PDF actualizados.
 f.listeners.get('forms-backclick')();f.draft.ops[0].id='OP2';
 event=registerEvent();f.listeners.get('documentclick')(event);assert.equal(event.prevented,undefined);
 f.listeners.get('multi-registerclick')();await settle();
 const updated=JSON.parse(f.session.get('cimagraf-pdf-pending-v1'));
 assert.notEqual(updated.id,archived.id);assert.equal(updated.snapshot.result.sourceOps[0].id,'OP2');
 assert.equal(archived.snapshot.result.sourceOps[0].id,'OP1');assert.equal(uploads(f).length,2);assert.ok(uploads(f)[1].url.includes(encodeURIComponent('OP2 - Kirin 1C.pdf')));
 // Incluso durante una carga lenta se puede volver y editar. Su finalización no vuelve a bloquear.
 f=fixture();let releaseUpload;
 const originalFetch=f.context.fetch;f.context.fetch=(...args)=>args[1].headers?.['Content-Type']==='application/pdf'?new Promise(resolve=>{releaseUpload=()=>resolve(originalFetch(...args));}):originalFetch(...args);
 f.listeners.get('multi-registerclick')();await settle();
 assert.equal(f.el('forms-back').disabled,false);f.listeners.get('forms-backclick')();assert.equal(f.el('multi-root').inert,false);
 f.draft.ops[0].id='CORREGIDA';event=registerEvent();f.listeners.get('documentclick')(event);assert.equal(event.prevented,true);
 releaseUpload();await settle();assert.equal(f.el('multi-root').inert,false);
 assert.equal(JSON.parse(f.session.get('cimagraf-pdf-pending-v1')).snapshot.ops[0].id,'OP1');
 // Un cambio de versión de cálculo no puede reutilizar un PDF con reglas anteriores.
 f=fixture();f.listeners.get('multi-registerclick')();await settle();
 f.listeners.get('forms-backclick')();f.draft.result.processRules=2;
 event=registerEvent();f.listeners.get('documentclick')(event);assert.equal(event.prevented,undefined);
 f.listeners.get('multi-registerclick')();await settle();assert.equal(uploads(f).length,2);
 // Recuperación real del editor: sus arrays no pueden mutar el resumen archivado.
 const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
 const restoreBody=html.match(/ restore:s=>\{([\s\S]*?)\},\n resume:/)[1];
 const saved={ops:[{id:'OP1'}],rolls:[{kg:400}],group:'01',paper:'Bond',gsm:90};
 const restoreContext={s:saved,$:()=>({}),updateGrams(){},restoreWidthSelection(){},redraw(){},show(){}};vm.createContext(restoreContext);
 vm.runInContext(restoreBody+';ops[0].id="EDITADA";rolls[0].kg=500;',restoreContext);
 assert.equal(saved.ops[0].id,'OP1');assert.equal(saved.rolls[0].kg,400);
 // No convertir antiguas copias de set up a libros: son unidades diferentes.
 restoreContext.s={...saved,ops:[{id:'OP1',setupCopies:10}]};
 vm.runInContext(restoreBody,restoreContext);
 assert.equal(vm.runInContext('ops[0].setupBooks',restoreContext),'');

 // Nombres nuevos: solo OP y máquina, también en el enlace y tras recuperar la sesión.
 f=fixture();j={id:'primer-registro',archiveFormat:2,created:'2026-11-04T20:00:00Z',snapshot:{result:f.r}};
 assert.equal(f.api.filename(j),'OP1 - Kirin 1C.pdf');
 f.api.setJob(j);await f.api.save();
 assert.equal(f.el('cloud-last-pdf').textContent,'OP1 - Kirin 1C.pdf');
 assert.equal(f.el('cloud-last-pdf').hidden,false);
 const stored=JSON.parse(f.session.get('cimagraf-pdf-pending-v1'));
 const recovered=fixture({pending:stored});assert.equal(recovered.el('cloud-last-pdf').textContent,'OP1 - Kirin 1C.pdf');assert.equal(recovered.calls.length,0);
 const second={id:'otro-registro',archiveFormat:2,created:j.created,snapshot:{result:f.r}};
 f.api.setJob(second);await f.api.save();
 assert.equal(uploads(f).length,2);assert.notEqual(uploads(f)[0].url,uploads(f)[1].url);
 for(const call of uploads(f))assert.ok(call.url.endsWith(encodeURIComponent('OP1 - Kirin 1C.pdf')+':/content'));
 for(const call of f.calls.filter(c=>c.options.method==='POST'))assert.equal(JSON.parse(call.options.body)['@microsoft.graph.conflictBehavior'],'fail');
 const multi={...j,snapshot:{result:{...f.r,machine:'Kirin 4C',sourceOps:[{id:'D1232'},{id:'D1233'}]}}};
 assert.equal(f.api.filename(multi),'D1232 + D1233 - Kirin 4C.pdf');
 const separated={...multi,opSeparator:'／'};assert.equal(f.api.filename(separated),'D1232 ／ D1233 - Kirin 4C.pdf');
 // El trabajo nuevo guarda la barra visual en el archivo y en el enlace; el anterior conserva +.
 const slashFixture=fixture();slashFixture.r.sourceOps.push({...slashFixture.r.sourceOps[0],id:'OP2'});
 slashFixture.listeners.get('multi-registerclick')();await settle();
 assert.equal(uploads(slashFixture).length,1);
 const slashUpload=new URL(uploads(slashFixture)[0].url);
 assert.equal(decodeURIComponent(slashUpload.pathname),'/v1.0/drives/drive/items/folder-Kirin 1C:/OP1 ／ OP2 - Kirin 1C.pdf:/content');
 assert.equal(slashUpload.searchParams.get('@microsoft.graph.conflictBehavior'),'rename');
 assert.deepEqual(slashFixture.calls.filter(c=>c.options.method==='POST').map(c=>JSON.parse(c.options.body).name),['Kirin 1C']);
 assert.equal(slashFixture.el('cloud-last-pdf').textContent,'OP1 ／ OP2 - Kirin 1C.pdf');
 const unsafe={...j,snapshot:{result:{...f.r,sourceOps:[{id:'D/123:4?'}]}}};assert.doesNotMatch(f.api.filename(unsafe),/[\\/:?]/);
 // Mismo nombre dentro de la carpeta de máquina: pide renombrar y el enlace conserva el nombre confirmado.
 f=fixture();const directFetch=f.context.fetch;
 f.context.fetch=async(url,options)=>{
  const res=await directFetch(url,options);
  if(options.headers?.['Content-Type']!=='application/pdf'||!url.includes('folder-Kirin%201C'))return res;
  const name=uploads(f).length===1?'OP1 - Kirin 1C.pdf':'OP1 - Kirin 1C (1).pdf';
  const item=await res.json();
  return {...res,json:async()=>({...item,name})};
 };
 for(let i=0;i<2;i++){
  f.listeners.get('multi-registerclick')();await settle();
  const name=i===0?'OP1 - Kirin 1C.pdf':'OP1 - Kirin 1C (1).pdf';
  assert.equal(f.el('cloud-last-pdf').textContent,name);
  const saved=JSON.parse(f.session.get('cimagraf-pdf-pending-v1'));
  assert.equal(saved.savedName,name);
  assert.equal(fixture({pending:saved}).el('cloud-last-pdf').textContent,name);
 }
 assert.equal(f.calls.filter(c=>c.options.method==='POST').length,1);
 assert.equal(uploads(f).length,2);
 for(const call of uploads(f)){
  const u=new URL(call.url);
  assert.equal(decodeURIComponent(u.pathname),'/v1.0/drives/drive/items/folder-Kirin 1C:/OP1 - Kirin 1C.pdf:/content');
  assert.equal(u.searchParams.get('@microsoft.graph.conflictBehavior'),'rename');
 }
 // Un registro 4C de la misma OP llega a la otra carpeta y mantiene el nombre.
 Object.assign(f.r,{machine:'Kirin 4C',machineKey:'kirin-4c'});
 f.listeners.get('multi-registerclick')();await settle();
 assert.deepEqual(f.calls.filter(c=>c.options.method==='POST').map(c=>JSON.parse(c.options.body).name),['Kirin 1C','Kirin 4C']);
 assert.equal(decodeURIComponent(new URL(uploads(f).at(-1).url).pathname),'/v1.0/drives/drive/items/folder-Kirin 4C:/OP1 - Kirin 4C.pdf:/content');
 // Si otra PC crea la carpeta entre la consulta y el intento, se reutiliza.
 f=fixture();const raceFetch=f.context.fetch;
 f.context.fetch=async(url,options)=>{
  const item=await raceFetch(url,options);
  if(options.method==='POST')return {ok:false,status:409,json:async()=>({error:{code:'nameAlreadyExists'}})};
  return item;
 };
 f.listeners.get('multi-registerclick')();await settle();
 assert.equal(uploads(f).length,1);
 assert.equal(f.calls.filter(c=>!c.options.method&&c.url.endsWith('Kirin%201C')).length,2);
 // Los PDF pendientes del formato directo anterior mantienen la ruta original.
 f=fixture();f.api.setJob({id:'anterior',archiveFormat:3,created:j.created,snapshot:{result:f.r}});
 await f.api.save();assert.equal(f.calls.length,1);
 assert.equal(decodeURIComponent(new URL(uploads(f)[0].url).pathname),'/v1.0/drives/drive/items/folder:/OP1 - Kirin 1C.pdf:/content');
 // Si falla la carga, se retoma la misma carpeta y el mismo nombre, sin crear otro registro.
 f=fixture();j={id:'reintento',archiveFormat:2,created:'2026-11-04T20:00:00Z',snapshot:{result:f.r}};
 let denyOnce=true;const originalUpload=f.context.fetch;
 f.context.fetch=async(url,options)=>{if(options.headers?.['Content-Type']==='application/pdf'&&denyOnce){denyOnce=false;f.calls.push({url,options});return {ok:false,status:403,json:async()=>({error:{code:'accessDenied'}})};}return originalUpload(url,options);};
 f.api.setJob(j);await f.api.save();assert.notEqual(j.saved,true);assert.ok(j.archiveFolder.id);
 await f.api.save();assert.equal(j.saved,true);assert.equal(f.calls.filter(c=>c.options.method==='POST').length,1);assert.equal(uploads(f)[0].url,uploads(f)[1].url);
 // Una respuesta perdida al crear carpeta se recupera por nombre, con el mismo UUID.
 f=fixture();j={id:'respuesta-perdida',archiveFormat:2,created:'2026-11-04T20:00:00Z',snapshot:{result:f.r}};
 const originalFolder=f.context.fetch;let folderExists=false,folderCreates=0;
 f.context.fetch=async(url,options)=>{
  if(options.method==='POST'){
   if(!folderExists){folderExists=true;folderCreates++;await originalFolder(url,options);throw new Error('Respuesta perdida');}
   f.calls.push({url,options});return {ok:false,status:409,json:async()=>({error:{code:'nameAlreadyExists'}})};
  }
  if(!options.method&&url.includes('Registro%20respuesta-perdida')){f.calls.push({url,options});return {ok:true,status:200,json:async()=>({id:'carpeta-recuperada',name:'Registro respuesta-perdida',folder:{}})};}
  return originalFolder(url,options);
 };
 f.api.setJob(j);await f.api.save();assert.notEqual(j.saved,true);await f.api.save();assert.equal(j.saved,true);assert.equal(folderCreates,1);assert.equal(uploads(f).length,1);
 assert.ok(uploads(f)[0].url.includes('carpeta-recuperada'));

 console.log('PDF: cálculo compartido, nombres OP/máquina, archivos separados, recuperación y reintentos correctos.');
})().catch(e=>{console.error(e);process.exitCode=1;});
