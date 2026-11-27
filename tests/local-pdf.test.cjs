const test=require('node:test'),assert=require('node:assert/strict');
const {CimagrafRecord}=require('../record-data.js');
test('El PDF usa OP y máquina, numera repeticiones y conserva el nombre al reintentar',async()=>{
 const files=new Map();let renders=0;
 const dir={getDirectoryHandle:async folder=>{
  assert.equal(folder,'PDF Kirin 1C');
  return {getFileHandle:async(name,options)=>{
   if(!files.has(name)){if(!options?.create)throw Object.assign(Error(),{name:'NotFoundError'});files.set(name,new Uint8Array());}
   return {getFile:async()=>new Blob([files.get(name)]),createWritable:async()=>({write:async bytes=>files.set(name,bytes),close:async()=>{}})};
  }};
 }};
 // El módulo del almacén recibe los formateadores de nombre del módulo de registros.
 const script=require('node:fs').readFileSync(require('node:path').join(__dirname,'../local-store.js'),'utf8');
 const window={CimagrafRecord};
 require('node:vm').runInNewContext(script,{window,crypto:require('node:crypto').webcrypto,Uint8Array,Error});
 const store=window.CimagrafLocalStore.create({dir,remember(){},renderPDF:async()=>{renders++;return new Uint8Array([37,80,68,70,renders]);}});
 const result={machineKey:'kirin-1c',machine:'Kirin 1C',sourceOps:[{id:'D1233'}]};
 const a={id:'primero',snapshot:{result}},b={id:'segundo',snapshot:{result}};
 await store.savePDF(a);await store.savePDF(b);await store.savePDF(a);
 assert.equal(a.pdfName,'D1233_KIRIN1C.pdf');assert.equal(b.pdfName,'D1233_KIRIN1C (2).pdf');
 assert.deepEqual([...files.keys()],[a.pdfName,b.pdfName]);assert.equal(renders,2);
});

test('Pruebas y producción guardan el mismo nombre en carpetas distintas',async()=>{
 const paths=[];
 function folder(prefix=''){
  return {getDirectoryHandle:async name=>folder(prefix+name+'/'),getFileHandle:async(name,options)=>{
   if(!options?.create)throw Object.assign(Error(),{name:'NotFoundError'});
   paths.push(prefix+name);return {createWritable:async()=>({write:async()=>{},close:async()=>{}})};
  }};
 }
 const script=require('node:fs').readFileSync(require('node:path').join(__dirname,'../local-store.js'),'utf8');
 const window={CimagrafRecord};
 require('node:vm').runInNewContext(script,{window,crypto:require('node:crypto').webcrypto,Uint8Array,Error});
 const store=window.CimagrafLocalStore.create({dir:folder(),remember(){},renderPDF:async()=>new Uint8Array([37,80,68,70])});
 const result={machineKey:'kirin-4c',machine:'Kirin 4C',sourceOps:[{id:'D1233'}]};
 for(const localPhase of ['test','production'])await store.savePDF({id:localPhase,draft:{localPhase},snapshot:{result}});
 await store.savePDF({id:'pendiente-antiguo',draft:{mode:'test'},snapshot:{result}});
 assert.deepEqual(paths,['Pruebas Kirin 4C/PDF Kirin 4C/D1233_KIRIN4C.pdf','Producción Kirin 4C/PDF Kirin 4C/D1233_KIRIN4C.pdf','PDF Kirin 4C/D1233_KIRIN4C.pdf']);
});
