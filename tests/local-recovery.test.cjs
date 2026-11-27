const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {CimagrafRecord}=require('../record-data.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../local-store.js'),'utf8');
const stale=()=>Object.assign(Error('An operation that depends on state cached in an interface object was made but the state had changed since it was read from disk.'),{name:'InvalidStateError'});
function fixture(){
 const files=new Map();let writes=0,reads=0,renders=0,failRead=0,failClose=false;
 const dir={getDirectoryHandle:async()=>({getFileHandle:async(name,options)=>{
  if(!files.has(name)){if(!options?.create)throw Object.assign(Error(),{name:'NotFoundError'});files.set(name,new Uint8Array());}
  return {getFile:async()=>({arrayBuffer:async()=>{reads++;if(failRead>0){failRead--;throw stale();}return new Uint8Array(files.get(name)).buffer;}}),createWritable:async()=>{let data;return {write:async bytes=>{writes++;data=bytes},close:async()=>{files.set(name,data);if(failClose){failClose=false;throw stale();}},abort:async()=>{}}}};
 }})};
 const window={CimagrafRecord};vm.runInNewContext(source,{window,crypto:require('node:crypto').webcrypto,Uint8Array,Error});
 const store=window.CimagrafLocalStore.create({dir,remember(){},renderPDF:async()=>{renders++;return new Uint8Array([37,80,68,70]);}});
 const job={id:'same-job',snapshot:{result:{machineKey:'kirin-1c',machine:'Kirin 1C',sourceOps:[{id:'D1233'}]}}};
 return {store,job,files,failRead:n=>failRead=n,failClose:()=>failClose=true,stats:()=>({writes,reads,renders})};
}
test('Estado desactualizado al releer: vuelve a abrir el PDF y confirma sin duplicar',async()=>{
 const f=fixture();await f.store.savePDF(f.job);f.job.saved=false;f.failRead(1);
 await f.store.savePDF(f.job);assert(f.job.saved);assert.equal(f.stats().writes,1);assert.equal(f.files.size,1);
});
test('Error tras cerrar un PDF ya escrito: verifica su contenido sin volver a escribir',async()=>{
 const f=fixture();f.failClose();await f.store.savePDF(f.job);
 assert(f.job.saved);assert.equal(f.stats().writes,1);assert.equal(f.stats().renders,1);assert.equal(f.files.size,1);
});
test('Archivo inaccesible de forma persistente: reintentos limitados y aviso claro en español',async()=>{
 const f=fixture();await f.store.savePDF(f.job);f.job.saved=false;f.failRead(99);const reads=f.stats().reads;
 await assert.rejects(()=>f.store.savePDF(f.job),error=>error.name==='LocalFileBusyError'&&/Cierra el Excel o el PDF/.test(error.message));
 assert.equal(f.stats().reads-reads,3);assert.equal(f.stats().writes,1);assert(!f.job.saved);
});
test('Otro PDF con el mismo nombre no se sobrescribe durante la recuperación',async()=>{
 const f=fixture();await f.store.savePDF(f.job);f.files.set(f.job.pdfName,new Uint8Array([1,2,3]));f.job.saved=false;f.failRead(1);
 await assert.rejects(()=>f.store.savePDF(f.job),/Ya existe otro PDF/);assert.equal(f.stats().writes,1);assert.deepEqual([...f.files.get(f.job.pdfName)],[1,2,3]);
});
