/* Guarda la operación en una carpeta que el operador eligió en este navegador. */
(function(scope){
'use strict';
const names={'kirin-1c':'Registro_Kirin_1C_Local.xlsx','kirin-4c':'Registro_Kirin_4C_Local.xlsx'}, sheetName='Registros';
const machines={'kirin-1c':'Kirin 1C','kirin-4c':'Kirin 4C'};
function subfolder(dir,machine,kind){
 if(!machines[machine])throw Error('Verifica la máquina seleccionada.');
 return dir.getDirectoryHandle((kind==='pdf'?'PDF ':'Base de datos ')+machines[machine],{create:true});
}
let db, excel;
function folders(){
 if(db)return db;
 db=new Promise((resolve,reject)=>{
  const open=indexedDB.open('cimagraf-bobinas-local',1);
  open.onupgradeneeded=()=>open.result.createObjectStore('folders');
  open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
 }).catch(e=>{db=null;throw e;});
 return db;
}
async function directory(machine,value){
 const connection=await folders();
 return new Promise((resolve,reject)=>{
  const t=connection.transaction('folders',value?'readwrite':'readonly'),store=t.objectStore('folders');
  const r=value?store.put(value,machine):store.get(machine);
  t.oncomplete=()=>resolve(r.result);t.onabort=()=>reject(t.error);
 });
}
async function choose(machine){
 if(!names[machine])throw Error('Primero selecciona la máquina.');
 if(!scope.showDirectoryPicker)throw Error('Abre el enlace en Edge o Chrome de escritorio para elegir una carpeta.');
 const selected=await scope.showDirectoryPicker({mode:'readwrite',startIn:'documents',id:'cimagraf-bobinas-'+machine});
 const previous=await directory(machine);
 if(previous&&!(await previous.isSameEntry(selected)))throw Error('Para continuar el mismo Excel, vuelve a elegir la carpeta registrada: '+previous.name+'.');
 await directory(machine,selected);return selected.name;
}
async function connect(machine){
 const dir=await directory(machine);
 if(!dir||await dir.queryPermission({mode:'readwrite'})!=='granted')
  throw Error('Pulsa «Elegir carpeta» y permite el acceso. Luego reintenta el guardado.');
 return dir;
}
function library(){
 if(scope.ExcelJS)return Promise.resolve(scope.ExcelJS);
 if(excel)return excel;
 excel=new Promise((resolve,reject)=>{
  const s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  s.integrity='sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz';
  s.crossOrigin='anonymous';s.onload=()=>scope.ExcelJS?resolve(scope.ExcelJS):reject(Error('No se pudo iniciar el generador de Excel.'));
  s.onerror=()=>{s.remove();reject(Error('No se pudo preparar Excel. Revisa Internet y reintenta.'));};
  document.head.append(s);
 }).catch(e=>{excel=null;throw e;});
 return excel;
}
async function existing(dir,name){
 try{return await dir.getFileHandle(name);}catch(e){if(e.name!=='NotFoundError')throw e;return null;}
}
async function write(handle,data){
 const output=await handle.createWritable({mode:'exclusive'});
 try{await output.write(data);await output.close();}catch(e){await output.abort().catch(()=>{});throw e;}
}
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
function create({dir,remember,onWrite=()=>{},renderPDF,loadExcel=library}){
 async function save(job){
  const result=job.snapshot.result, fname=names[result.machineKey],record=scope.CimagrafRecord;
  if(!fname||record.missing(result))throw Error('Verifica la máquina, el lote y el SAP.');
  const rows=record.rows(result,job.created,job.id,job.pdfReceipt?.pdfName||'');
  rows.forEach(row=>{row[24]='LOCAL';});
  if(!rows.length)throw Error('No hay movimientos para guardar.');
  const {Workbook}=await loadExcel(), book=new Workbook();
  const target=await subfolder(dir,result.machineKey,'excel');
  let handle=await existing(target,fname), sheet, before;
  const current=handle?await handle.getFile():null;
  if(current&&!current.size&&!job.localNewBook)throw Error('El Excel local está vacío. Conserva el archivo y revisa la carpeta antes de reintentar.');
  // Si ya se usó la versión anterior, iniciar el libro nuevo con su historial.
  const legacy=!current?.size?await existing(dir,fname):null;
  const source=legacy||handle;
  if(source){
   const file=legacy?await legacy.getFile():current;
   if(file.size===0&&!job.localNewBook)throw Error('El Excel local está vacío. Conserva el archivo y revisa la carpeta antes de reintentar.');
   before=await file.arrayBuffer();
   if(file.size>0){
   await book.xlsx.load(before).catch(()=>{throw Error('No se pudo leer el Excel local. El archivo original se conservó.');});
   sheet=book.getWorksheet(sheetName);
   if(!sheet||record.headers.some((name,i)=>sheet.getRow(1).getCell(i+1).value!==name))throw Error('Los encabezados del Excel no coinciden. El archivo original se conservó.');
   }
  }
  if(!sheet){
   sheet=book.addWorksheet(sheetName,{views:[{state:'frozen',ySplit:1}]});
   sheet.columns=record.headers.map(header=>({header,width:Math.max(14,header.length+3)}));
   sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
   sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF15385B'}};
   sheet.autoFilter='A1:Z1';
  }
  const seen=new Map();
  sheet.eachRow(row=>{const key=row.getCell(26).value;if(typeof key==='string'&&key.startsWith(job.id+':'))seen.set(key,seen.has(key)?null:row);});
  if(seen.size){
   if(seen.size!==rows.length||rows.some(row=>!seen.get(row[25])||row.some((v,i)=>(seen.get(row[25]).getCell(i+1).value??'')!==v)))throw Error('El Excel ya contiene parte de este registro. Verifica el archivo antes de reintentar.');
  }else{
   sheet.addRows(rows);
   sheet.autoFilter='A1:Z'+sheet.rowCount;
  }
  if(!seen.size||legacy){
   const data=seen.size?before:await book.xlsx.writeBuffer();
   job.plan={local:true};remember(job);onWrite();
   if(source){
    const latest=await (await source.getFile()).arrayBuffer();
    if(await digest(latest)!==await digest(before))throw Error('El Excel cambió mientras se guardaba. Cierra Excel y reintenta.');
   }
   if(handle){
    if(legacy&&(await handle.getFile()).size)throw Error('El Excel de destino cambió. Reintenta el mismo registro.');
   }else{
    if(await existing(target,fname))throw Error('Se creó el Excel en otra ventana. Reintenta el mismo registro.');
    job.localNewBook=true;remember(job);
    handle=await target.getFileHandle(fname,{create:true});
   }
   await write(handle,data);
  }
  job.saved=true;job.lockReleased=true;job.excelName=fname;remember(job);
 }
 async function savePDF(job){
  const record=scope.CimagrafRecord,result=job.snapshot.result;
  const base=record.filename(result).replace(/\.pdf$/i,'');
  const name=job.pdfName||(base+'_'+job.id.replace(/[^\w-]/g,'')+'.pdf');
  const target=await subfolder(dir,result.machineKey,'pdf');
  let handle=await existing(target,name);
  if(handle&&(await handle.getFile()).size){
   if(!job.pdfHash||await digest(await (await handle.getFile()).arrayBuffer())!==job.pdfHash)throw Error('Ya existe otro PDF con este nombre. No se reemplazó.');
  }else{
   if(handle&&!job.pdfStarted)throw Error('Ya existe un PDF vacío con este nombre. No se reemplazó.');
   const legacy=job.pdfStarted?await existing(dir,name):null;
   const old=legacy?await legacy.getFile():null;
   const data=old?.size?await old.arrayBuffer():await renderPDF(result,job.created);
   const hash=await digest(data);
   if(old?.size&&hash!==job.pdfHash)throw Error('El PDF anterior no coincide con este registro. No se reemplazó.');
   job.pdfName=name;job.pdfHash=hash;job.pdfStarted=true;remember(job);onWrite();
   if(!handle)handle=await target.getFileHandle(name,{create:true});
   await write(handle,data);
  }
  job.saved=true;job.lockReleased=true;remember(job);
 }
 return {save,savePDF};
}
scope.CimagrafLocalStore={choose,connect,create};
})(typeof window==='undefined'?module.exports:window);
