const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {CimagrafRegistry:R}=require('../machine-registry.js');
const fail=status=>Object.assign(new Error('Simulado '+status),{status});
function server(){
 const folders=new Map(),records=new Map(),calls=[];let serial=0,lose=false;
 async function request(path,options={}){
  calls.push({path,options});await new Promise(r=>setImmediate(r));
  if(path.endsWith('/children')&&options.method==='POST'){
   const data=JSON.parse(options.body),key=path.slice(0,-9)+':/'+encodeURIComponent(data.name);
   assert.equal(data['@microsoft.graph.conflictBehavior'],'fail');
   if(folders.has(key))throw fail(409);
   const item={id:'folder-'+(++serial),name:data.name,folder:{}};folders.set(key,item);return item;
  }
  if(path.includes('/children?'))return {value:[...records.keys()].filter(k=>k.startsWith(path.split('/children?')[0]+':/')).map(k=>({name:k.split(':/')[1].split(':/')[0]}))};
  if(path.includes(':/content')){
   const key=path.split('?')[0];
   if(options.method==='PUT'){
    assert.ok(path.endsWith('?@microsoft.graph.conflictBehavior=fail'));
    if(records.has(key))throw fail(409);
    records.set(key,JSON.parse(options.body));if(lose){lose=false;throw Error('Conexión perdida después de guardar');}
    return {id:'record',name:key.split(':/')[1]};
   }
   if(!records.has(key))throw fail(404);return records.get(key);
  }
  if(!folders.has(path))throw fail(404);return folders.get(path);
 }
 return {request,records,calls,loseNext:()=>lose=true};
}
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map};};
function ui({local=storage(),session=storage(),linked=false,valid=true,central=server()}={}){
 const nodes={},events={},windowEvents={},documentEvents={};let opened=0,connections=0,preflights=0;
 const el=id=>nodes[id]??={value:'',hidden:false,disabled:false,open:false,textContent:'',inert:false,classList:{contains:()=>id==='forms-modal'&&!!nodes[id]?.open,toggle(){}},addEventListener:(kind,fn)=>events[id+':'+kind]=fn};
 el('multi-register').click=()=>{const e={target:{closest:s=>s==='#multi-register'},preventDefault(){this.prevented=true;},stopImmediatePropagation(){}};documentEvents.click(e);if(!e.prevented){opened++;el('forms-modal').open=true;}};
 const window={CimagrafRegistry:R,CimagrafMachineForm:linked?{machine:'r'+'a'.repeat(32),recordId:'r'+'b'.repeat(32)}:{},addEventListener:(e,fn)=>windowEvents[e]=fn,CimagrafCloud:{connect:async()=>{connections++;return {destination:{drive:'d',id:'pdf'},request:central.request};}},CimagrafArchive:{refresh(){},preflight(){preflights++;return valid;},snapshot:()=>({result:{sourceOps:[{id:'OP1'}]},ops:[{id:'OP1'}]}),restore(){}}};
 const c={window,localStorage:local,sessionStorage:session,crypto:require('node:crypto').webcrypto,document:{getElementById:el,addEventListener:(e,fn)=>documentEvents[e]=fn},URL,console};
 vm.createContext(c);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../production.js'),'utf8'),c);
 const settle=async()=>{for(let i=0;i<60;i++)await new Promise(r=>setImmediate(r));};
 return {el,events,api:window.CimagrafProduction,central,local,session,settle,choose:machine=>{el('machine-select').value=machine;events['machine-select:change']();},click:()=>el('multi-register').click(),activate:()=>events['machine-start-confirm-button:click'](),get opened(){return opened;},get connections(){return connections;},get preflights(){return preflights;}};
}
(async()=>{
 let count=0;
 const test=async(name,fn)=>{await fn();count++;console.log('OK '+name);};
 await test('Contadores independientes y recuperación desde otra PC',async()=>{
  const s=server(),r=R.create({request:s.request,saveAttempt(){}});
  const a=await r.open({drive:'d',id:'pdf'},'kirin-1c'),b=await r.open({drive:'d',id:'pdf'},'kirin-4c');
  assert.equal((await r.reserve(a,'kirin-1c',{id:'a'})).recordId,'KIRIN 1C - 01');
  assert.equal((await r.reserve(b,'kirin-4c',{id:'b'})).recordId,'KIRIN 4C - 01');
  const pc2=R.create({request:s.request,saveAttempt(){}});assert.equal(await pc2.next(await pc2.open({drive:'d',id:'pdf'},'kirin-1c')),2);
 });
 await test('Dos reservas simultáneas de la misma máquina nunca duplican el ID',async()=>{
  const s=server(),r=R.create({request:s.request,saveAttempt(){}}),p=await r.open({drive:'d',id:'pdf'},'kirin-1c');
  const both=await Promise.all([r.reserve(p,'kirin-1c',{id:'a'}),r.reserve(p,'kirin-1c',{id:'b'})]);
  assert.deepEqual(both.map(x=>x.number).sort(),[1,2]);assert.equal(s.records.size,2);
 });
 await test('Respuesta perdida y reintento conservan el ID ya guardado',async()=>{
  const s=server(),persisted=[],r=R.create({request:s.request,saveAttempt:d=>persisted.push(structuredClone(d))}),p=await r.open({drive:'d',id:'pdf'},'kirin-1c'),d={id:'a'};
  s.loseNext();await assert.rejects(()=>r.reserve(p,'kirin-1c',d),/perdida/);assert.equal(persisted.at(-1).attempt,1);
  assert.equal((await r.reserve(p,'kirin-1c',d)).number,1);assert.equal(s.records.size,1);
 });
 await test('Paginación incluye reservas antiguas y rechaza enlaces ajenos',async()=>{
  let call=0;const r=R.create({saveAttempt(){},request:async()=>++call===1?{value:[{name:'0000000002.json'}],'@odata.nextLink':'https://graph.microsoft.com/v1.0/drives/d/items/i/children?$skiptoken=next'}:{value:[{name:'0000000042.json'}]}});
  assert.equal(await r.next('/drives/d/items/i'),43);
  const bad=R.create({saveAttempt(){},request:async()=>({value:[],'@odata.nextLink':'https://evil.example/'})});await assert.rejects(()=>bad.next('/drives/d/items/i'),/no válida/);
 });
 await test('Asignación recordada; pruebas no reservan IDs de producción',async()=>{
  const f=ui();assert.equal(f.api.ready(),false);f.choose('kirin-1c');assert.equal(f.el('multi-group').value,'PRUEBA · KIRIN 1C - 01');assert.equal(f.el('machine-start').disabled,true);
  const reload=ui({local:f.local,session:f.session});assert.equal(reload.api.metadata().machine,'Kirin 1C');
  f.click();f.click();await f.settle();assert.equal(f.opened,1);assert.equal(f.connections,0);assert.equal(f.central.records.size,0);
  f.el('forms-modal').open=false;f.click();await f.settle();assert.equal(f.el('multi-group').value,'PRUEBA · KIRIN 1C - 01');
  f.api.reset();assert.equal(f.el('multi-group').value,'PRUEBA · KIRIN 1C - 02');
 });
 await test('Datos inválidos no consumen número ni abren Forms',async()=>{const f=ui({valid:false});f.choose('kirin-4c');f.click();await f.settle();assert.equal(f.opened,0);assert.equal(f.connections,0);assert.equal(f.el('multi-group').value,'PRUEBA · KIRIN 4C - 01');});
 await test('Producción pendiente del enlace Forms no se puede activar',async()=>{const f=ui();f.choose('kirin-1c');await f.activate();assert.equal(f.connections,0);assert.match(f.el('machine-status').textContent,/conecta/);});
 await test('Activación sin gastar el 1; botón desaparece; envío y reintento cuentan una vez',async()=>{
  const f=ui({linked:true});f.choose('kirin-4c');await f.activate();assert.equal(f.el('machine-start').hidden,true);assert.equal(f.el('multi-group').value,'KIRIN 4C - 01');assert.equal(f.central.records.size,0);
  f.click();await f.settle();assert.equal(f.opened,1);assert.equal(f.central.records.size,1);
  f.el('forms-modal').open=false;f.click();await f.settle();assert.equal(f.central.records.size,1);assert.equal(f.el('multi-group').value,'KIRIN 4C - 01');
  f.api.reset();assert.equal(f.el('multi-group').value,'KIRIN 4C - 02');
  const reload=ui({linked:true,local:f.local,session:f.session,central:f.central});assert.equal(reload.el('machine-start').hidden,true);assert.equal(reload.el('machine-select').disabled,true);
 });
 await test('Volver a activar desde un navegador nuevo continúa, nunca reinicia',async()=>{
  const central=server(),first=ui({linked:true,central});first.choose('kirin-1c');await first.activate();first.click();await first.settle();
  const second=ui({linked:true,central});second.choose('kirin-1c');await second.activate();assert.equal(second.el('multi-group').value,'KIRIN 1C - 02');
 });
 await test('Un envío pendiente mantiene su ID anterior; el siguiente usa el formato corto',async()=>{
  const first=ui({linked:true});first.choose('kirin-1c');await first.activate();first.click();await first.settle();
  first.session.setItem('cimagraf-pdf-pending-v1',JSON.stringify({snapshot:{result:{machine:'Kirin 1C',machineKey:'kirin-1c',recordId:'KIRIN 1C-0001'}}}));
  const recovered=ui({linked:true,central:first.central,local:first.local,session:first.session});
  assert.equal(recovered.api.metadata().recordId,'KIRIN 1C-0001');
  recovered.api.reset();assert.equal(recovered.api.metadata().recordId,'KIRIN 1C - 02');assert.equal(first.central.records.size,1);
 });
 console.log(count+' pruebas de asignación y numeración correctas.');
})().catch(e=>{console.error(e);process.exitCode=1;});
