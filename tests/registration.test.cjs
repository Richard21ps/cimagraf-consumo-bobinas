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
 console.log(count+' pruebas de asignación y numeración correctas.');
})().catch(e=>{console.error(e);process.exitCode=1;});
