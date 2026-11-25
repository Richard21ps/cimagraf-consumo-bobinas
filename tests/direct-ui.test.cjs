const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {CimagrafRegistry:registry}=require('../machine-registry.js');
const {calculate}=require('./excel-fixture.cjs');
function storage(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}
function ui({local=storage(),session=storage(),failure='',query=''}={}){
 const nodes={},handlers={},events={},document={getElementById:id=>node(id)};let connections=0,saves=0,resets=0,prints=0,restores=0,fail=failure;
 const node=id=>nodes[id]??={value:'',hidden:false,disabled:false,inert:false,open:false,textContent:'',classList:{toggle(){}},addEventListener:(kind,fn)=>handlers[id+':'+kind]=fn,removeAttribute(k){delete this[k];}};
 let snapshot={result:JSON.parse(JSON.stringify(calculate())),ops:[{id:'D13924'}],rolls:[],paper:'Bond',gsm:75,width:480,group:'PRUEBA · KIRIN 1C - 01'};
 const window={addEventListener:(name,fn)=>events[name]=fn,CimagrafRegistry:registry,
  CimagrafArchive:{refresh(){},preflight:()=>true,snapshot:()=>structuredClone(snapshot),reportHTML:()=>'<article>Rótulo</article>',restore:s=>{restores++;snapshot=structuredClone(s);},reset(){resets++;window.CimagrafProduction.reset();},print(){prints++;}},
  CimagrafCloud:{connect:async()=>{connections++;if(fail==='auth')throw Error('Sin acceso');return {request:async()=>({value:[]}),destination:{drive:'d',id:'root'}};}},
  CimagrafReportPDF:{render:async()=>new ArrayBuffer(1)},
  CimagrafExcelStore:{create:({remember})=>({save:async j=>{saves++;if(fail==='partial'){j.plan={start:2};remember(j);throw Error('Conexión interrumpida');}j.saved=true;j.lockReleased=true;j.excelUrl='https://empresa.sharepoint.com/libro';j.pdfUrl='https://empresa.sharepoint.com/pdf';remember(j);}})}
 };
 const context={window,document,localStorage:local,sessionStorage:session,crypto:require('node:crypto').webcrypto,navigator:{},URL,location:{hash:query,search:''},console};
 vm.createContext(context);for(const file of ['production.js','cloud-excel.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
 return {window,local,session,node,events,choose:machine=>{node('machine-select').value=machine;handlers['machine-select:change']();},click:id=>handlers[id+':click'](),fail:value=>fail=value,stats:()=>({connections,saves,resets,prints,restores}),settle:async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));}};
}
test('Un clic guarda; siguiente grupo incrementa pruebas y desbloquea el editor',async()=>{
 const f=ui();f.choose('kirin-1c');await f.click('multi-register');
 assert.equal(f.stats().saves,1);assert.equal(f.node('cloud-next').hidden,false);assert.equal(f.node('multi-root').inert,true);
 await f.click('multi-register');assert.equal(f.stats().saves,1);
 f.click('cloud-print');assert.equal(f.stats().prints,1);
 f.click('cloud-next');assert.equal(f.stats().resets,1);assert.equal(f.node('multi-root').inert,false);assert.equal(f.local.getItem('cimagraf-excel-pending-v1'),null);
 assert.equal(f.window.CimagrafProduction.metadata().recordId,'PRUEBA · KIRIN 1C - 02');
});
test('Error antes de guardar permite corregir sin perder la asignación ni gastar ID',async()=>{
 const f=ui({failure:'auth'});f.choose('kirin-4c');await f.click('multi-register');
 assert.equal(f.stats().saves,0);assert.equal(f.node('cloud-edit').hidden,false);f.click('cloud-edit');assert.equal(f.node('multi-root').inert,false);
 assert.equal(f.window.CimagrafProduction.metadata().recordId,'PRUEBA · KIRIN 4C - 01');
});
test('Fallo parcial conserva grupo y número; reintento confirma una sola vez',async()=>{
 const f=ui({failure:'partial'});f.choose('kirin-1c');await f.click('multi-register');
 assert.equal(f.node('cloud-edit').hidden,true);assert.equal(f.node('cloud-next').hidden,true);assert.equal(f.node('cloud-retry').hidden,false);
 assert.equal(f.window.CimagrafProduction.metadata().recordId,'PRUEBA · KIRIN 1C - 01');
 f.fail('');await f.click('cloud-retry');assert.equal(f.node('cloud-next').hidden,false);assert.equal(f.node('cloud-retry').hidden,true);
});
test('Cerrar y abrir conserva un pendiente y lo restaura sin otro guardado automático',async()=>{
 const first=ui({failure:'partial'});first.choose('kirin-1c');await first.click('multi-register');
 const next=ui({local:first.local});assert.equal(next.stats().restores,1);assert.equal(next.stats().saves,0);assert.equal(next.node('multi-root').inert,true);
 await next.click('cloud-retry');assert.equal(next.node('cloud-next').hidden,false);
});
test('Retorno del inicio de sesión completa el guardado solicitado',async()=>{
 const first=ui({failure:'auth'});first.choose('kirin-1c');await first.click('multi-register');
 const next=ui({local:first.local,query:'#code=simulado'});await next.settle();assert.equal(next.stats().saves,1);assert.equal(next.node('cloud-next').hidden,false);
});
test('Recuperación conserva el intento de numeración más reciente de la sesión',()=>{
 const local=storage(),session=storage(),draft={id:'same-id',machine:'kirin-1c',mode:'production',number:1,sent:false};
 local.setItem('cimagraf-machine-v1',JSON.stringify({machine:'kirin-1c',production:true}));
 local.setItem('cimagraf-excel-pending-v1',JSON.stringify({draft}));session.setItem('cimagraf-registration-v1',JSON.stringify({...draft,attempt:7}));
 const f=ui({local,session});assert.equal(f.window.CimagrafProduction.state().attempt,7);
});
test('Producción: activa sin consumir un ID; guarda una vez y continúa el contador',async()=>{
 const original=registry.create;let reserves=0;
 registry.create=()=>({open:async()=>'/control',next:async()=>3,reserve:async(_,key)=>{reserves++;return {number:3,recordId:registry.recordId(key,3)};}});
 try{
  const f=ui();f.choose('kirin-4c');await f.click('machine-start-confirm-button');
  assert.equal(f.node('machine-start').hidden,true);assert.equal(reserves,0);assert.equal(f.window.CimagrafProduction.metadata().recordId,'KIRIN 4C - 03');
  await f.click('multi-register');assert.equal(reserves,1);f.click('cloud-next');assert.equal(f.window.CimagrafProduction.metadata().recordId,'KIRIN 4C - 04');
 }finally{registry.create=original;}
});
