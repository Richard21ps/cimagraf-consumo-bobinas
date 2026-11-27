/* Guarda la operación en una carpeta que el operador eligió en este navegador. */
(function(scope){
'use strict';
const names={'kirin-1c':'Registro_Kirin_1C_Local.xlsx','kirin-4c':'Registro_Kirin_4C_Local.xlsx'}, sheetName='Registros';
const machines={'kirin-1c':'Kirin 1C','kirin-4c':'Kirin 4C'};
function phaseFolder(dir,machine,phase){
 if(!phase)return dir;
 if(!machines[machine]||!['test','production'].includes(phase))throw Error('Verifica la máquina y el modo de guardado.');
 return dir.getDirectoryHandle((phase==='production'?'Producción ':'Pruebas ')+machines[machine],{create:true});
}
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
async function authorizedFolder(machine){
 if(!names[machine])return null;
 const dir=await directory(machine);
 return dir&&await dir.queryPermission({mode:'readwrite'})==='granted'?dir:null;
}
async function connect(machine){
 const dir=await authorizedFolder(machine);
 if(!dir)
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
async function prepareProduction(machine){
 const root=await phaseFolder(await connect(machine),machine,'production');
 const target=await subfolder(root,machine,'excel');
 await subfolder(root,machine,'pdf');
 const handle=await existing(target,names[machine]);
 if(!handle)return 1;
 const {Workbook}=await library(), book=new Workbook();
 await book.xlsx.load(await (await handle.getFile()).arrayBuffer());
 const sheet=book.getWorksheet(sheetName);
 if(!sheet||sheet.getRow(1).getCell(4).value!=='Registro')throw Error('No se pudo recuperar la numeración del Excel de producción.');
 let last=0;const prefix=machines[machine].toUpperCase()+' - ';
 sheet.eachRow(row=>{
  const value=row.getCell(4).value;
  if(typeof value==='string'&&value.startsWith(prefix)){
   const number=value.slice(prefix.length);
   if(/^\d+$/.test(number)&&Number.isSafeInteger(Number(number)))last=Math.max(last,Number(number));
  }
 });
 if(last>=Number.MAX_SAFE_INTEGER)throw Error('Se alcanzó el límite de numeración.');
 return last+1;
}
// Leer los bytes de inmediato: un objeto File deja de ser legible si cambia en disco.
async function readSnapshot(handle){
 const file=await handle.getFile();
 const data=await file.arrayBuffer();
 return {size:data.byteLength,data};
}
function staleFile(error){return ['InvalidStateError','NotReadableError'].includes(error?.name);}
async function recoverLocal(operation,job){
 for(let attempt=0;attempt<3;attempt++){
  try{return await operation(job);}catch(error){
   if(!staleFile(error))throw error;
   if(attempt===2)throw Object.assign(Error('No se pudo acceder a la versión actual del archivo. Cierra el Excel o el PDF si están abiertos y pulsa «Reintentar guardado». Tus datos siguen en la calculadora.'),{name:'LocalFileBusyError'});
   // Reabrir y comprobar el registro completo antes de volver a escribir.
   if(typeof scope.setTimeout==='function')await new Promise(resolve=>scope.setTimeout(resolve,150));
  }
 }
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
  const rows=record.localRows(result,job.created,job.id,job.pdfReceipt?.pdfName||'');
  rows.forEach(row=>{row[24]=job.draft?.localPhase==='production'?'PRODUCCIÓN':job.draft?.localPhase==='test'?'PRUEBA':'LOCAL';});
  if(!rows.length)throw Error('No hay movimientos para guardar.');
  const {Workbook}=await loadExcel(), book=new Workbook();
  const root=await phaseFolder(dir,result.machineKey,job.draft?.localPhase);
  const target=await subfolder(root,result.machineKey,'excel');
  let handle=await existing(target,fname), sheet, before, schemaChanged=false;
  const current=handle?await readSnapshot(handle):null;
  if(current&&!current.size&&!job.localNewBook)throw Error('El Excel local está vacío. Conserva el archivo y revisa la carpeta antes de reintentar.');
  // Si ya se usó la versión anterior, iniciar el libro nuevo con su historial.
  const legacy=!current?.size?await existing(root,fname):null;
  const source=legacy||handle;
  if(source){
   const file=legacy?await readSnapshot(legacy):current;
   if(file.size===0&&!job.localNewBook)throw Error('El Excel local está vacío. Conserva el archivo y revisa la carpeta antes de reintentar.');
   before=file.data;
   if(file.size>0){
   await book.xlsx.load(before).catch(()=>{throw Error('No se pudo leer el Excel local. El archivo original se conservó.');});
   sheet=book.getWorksheet(sheetName);
   if(!sheet||record.headers.some((name,i)=>sheet.getRow(1).getCell(i+1).value!==name))throw Error('Los encabezados del Excel no coinciden. El archivo original se conservó.');
   const header=sheet.getRow(1);
   if([27,28].every(i=>header.getCell(i).value==null)){
    for(let i=26;i<record.localHeaders.length;i++){
     header.getCell(i+1).value=record.localHeaders[i];sheet.getColumn(i+1).width=18;
    }
    sheet.autoFilter='A1:AB'+sheet.rowCount;schemaChanged=true;
   }
   if(record.localHeaders.some((name,i)=>header.getCell(i+1).value!==name))throw Error('Las columnas de ahorro no coinciden. El archivo original se conservó.');
   }
  }
  if(!sheet){
   sheet=book.addWorksheet(sheetName,{views:[{state:'frozen',ySplit:1}]});
   sheet.columns=record.localHeaders.map(header=>({header,width:Math.max(14,header.length+3)}));
   sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
   sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF15385B'}};
   sheet.autoFilter='A1:AB1';
  }
  // Una fila por grupo, en una hoja independiente: no repite el ahorro por OP/bobina.
  const comparisonRow=result.savingsInRegister?null:record.comparisonRow(result,job.created,job.id);
  let comparisonAdded=false;
  if(comparisonRow){
   let comparisonSheet=book.getWorksheet('Comparación por grupo');
   if(comparisonSheet){
    const header=comparisonSheet.getRow(1);
    const legacy=record.comparisonHeaders.slice(0,11).every((name,i)=>header.getCell(i+1).value===name)&&[12,13,14].every(i=>header.getCell(i).value==null);
    if(legacy){
     // Añadir columnas sin recalcular el porcentaje histórico ni tocar sus datos.
     for(let i=11;i<record.comparisonHeaders.length;i++){
      header.getCell(i+1).value=record.comparisonHeaders[i];comparisonSheet.getColumn(i+1).width=Math.max(18,record.comparisonHeaders[i].length+3);
     }
     comparisonSheet.eachRow((row,n)=>{if(n>1)row.getCell(14).value='Devolución prevista';});
     comparisonAdded=true;
    }
    if(record.comparisonHeaders.some((name,i)=>header.getCell(i+1).value!==name))throw Error('Los encabezados de comparación no coinciden. El archivo original se conservó.');
   }else{
    comparisonSheet=book.addWorksheet('Comparación por grupo',{views:[{state:'frozen',ySplit:1}]});
    comparisonSheet.columns=record.comparisonHeaders.map(header=>({header,width:Math.max(18,header.length+3)}));
    comparisonSheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
    comparisonSheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF15385B'}};
   }
   const matches=[];comparisonSheet.eachRow(row=>{if(row.getCell(11).value===job.id)matches.push(row);});
   if(matches.length>1||matches.length&&comparisonRow.some((v,i)=>(matches[0].getCell(i+1).value??'')!==v))throw Error('La comparación de este registro ya existe con otros datos. Conserva el archivo y revisa el registro.');
   if(!matches.length){
    const row=comparisonSheet.addRow(comparisonRow);
    for(const i of [6,7,8,9,12,13])row.getCell(i).numFmt='0.0';
    row.getCell(10).font={bold:true,color:{argb:comparisonRow[7]>0?'FF176641':comparisonRow[7]<0?'FFA1252D':'FF355367'}};
    comparisonAdded=true;
   }
   comparisonSheet.autoFilter='A1:N'+comparisonSheet.rowCount;
  }
  const seen=new Map();
  sheet.eachRow(row=>{const key=row.getCell(26).value;if(typeof key==='string'&&key.startsWith(job.id+':'))seen.set(key,seen.has(key)?null:row);});
  if(seen.size){
   if(seen.size!==rows.length||rows.some(row=>!seen.get(row[25])||row.some((v,i)=>(seen.get(row[25]).getCell(i+1).value??'')!==v)))throw Error('El Excel ya contiene parte de este registro. Verifica el archivo antes de reintentar.');
  }else{
   const added=sheet.addRows(rows);
   for(const row of added)for(const i of [27,28]){
    row.getCell(i).numFmt='0.0';
    if(typeof row.getCell(i).value==='number')row.getCell(i).font={bold:true,color:{argb:row.getCell(i).value<0?'FFA1252D':'FF176641'}};
   }
   sheet.autoFilter='A1:AB'+sheet.rowCount;
  }
  if(!seen.size||legacy||comparisonAdded||schemaChanged){
   const data=seen.size&&!comparisonAdded&&!schemaChanged?before:await book.xlsx.writeBuffer();
   job.plan={local:true};remember(job);onWrite();
   if(source){
    const latest=(await readSnapshot(source)).data;
    if(await digest(latest)!==await digest(before))throw Error('El Excel cambió mientras se guardaba. Cierra Excel y reintenta.');
   }
   if(handle){
    if(legacy&&(await handle.getFile()).size)throw Error('El Excel de destino cambió. Reintenta el mismo registro.');
   }else{
    if(await existing(target,fname))throw Error('Se creó el Excel en otra ventana. Reintenta el mismo registro.');
    job.localNewBook=true;remember(job);
    handle=await target.getFileHandle(fname,{create:true});
   }
   handle=await existing(target,fname)||handle;
   await write(handle,data);
  }
  job.saved=true;job.lockReleased=true;job.excelName=fname;remember(job);
 }
 async function savePDF(job){
  const record=scope.CimagrafRecord,result=job.snapshot.result;
  const base=record.filename(result).replace(/\.pdf$/i,'');
  const root=await phaseFolder(dir,result.machineKey,job.draft?.localPhase);
  const target=await subfolder(root,result.machineKey,'pdf');
  let name=job.pdfName||base+'.pdf',handle=await existing(target,name);
  for(let copy=2;!job.pdfName&&handle;copy++){
   if(copy>9999)throw Error('Hay demasiados informes con este nombre.');
   name=base+' ('+copy+').pdf';handle=await existing(target,name);
  }
  const current=handle?await readSnapshot(handle):null;
  if(current?.size){
   if(!job.pdfHash||await digest(current.data)!==job.pdfHash)throw Error('Ya existe otro PDF con este nombre. No se reemplazó.');
  }else{
   if(handle&&!job.pdfStarted)throw Error('Ya existe un PDF vacío con este nombre. No se reemplazó.');
   const legacy=job.pdfStarted?await existing(root,name):null;
   const old=legacy?await readSnapshot(legacy):null;
   const data=old?.size?old.data:await renderPDF(result,job.created);
   const hash=await digest(data);
   if(old?.size&&hash!==job.pdfHash)throw Error('El PDF anterior no coincide con este registro. No se reemplazó.');
   if(!handle&&await existing(target,name))throw Error('Ya se creó un PDF con este nombre. Reintenta para guardar sin reemplazarlo.');
   job.pdfName=name;job.pdfHash=hash;job.pdfStarted=true;remember(job);onWrite();
   if(!handle)handle=await target.getFileHandle(name,{create:true});
   await write(handle,data);
  }
  job.saved=true;job.lockReleased=true;remember(job);
 }
 return {save:job=>recoverLocal(save,job),savePDF:job=>recoverLocal(savePDF,job)};
}
scope.CimagrafLocalStore={choose,connect,authorizedFolder,prepareProduction,create};
})(typeof window==='undefined'?module.exports:window);
