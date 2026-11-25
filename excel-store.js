/* Escrituras secuenciales e idempotentes: una reserva fija por registro. */
(function(scope){
'use strict';
const BOOK='Registro_Bobinas_Cimagraf.xlsx',LOCK='guardado-excel.json';
const json=value=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
const path=(parent,name)=>parent+':/'+encodeURIComponent(name);
const itemPath=(drive,id)=>'/drives/'+encodeURIComponent(drive)+'/items/'+encodeURIComponent(id);
const same=(a,b)=>typeof b==='number'?typeof a==='number'&&Math.abs(a-b)<1e-7:String(a??'').replace(/^'(?=[=+\-@])/,'')===String(b??'').replace(/^'(?=[=+\-@])/,'');
function create({cloud,remember,loadTemplate,renderPDF,status=()=>{}}){
 const request=cloud.request,root=itemPath(cloud.destination.drive,cloud.destination.id);
 async function optional(url){try{return await request(url);}catch(e){if(e.status===404)return null;throw e;}}
 async function folder(parent,name){
  let found=await optional(path(parent,name));
  if(!found){try{found=await request(parent+'/children',json({name,folder:{},'@microsoft.graph.conflictBehavior':'fail'}));}catch(e){if(e.status!==409)throw e;found=await request(path(parent,name));}}
  if(!found.folder||!found.id)throw Error('La ubicación '+name+' no es una carpeta.');
  return itemPath(cloud.destination.drive,found.id);
 }
 async function file(parent,name,data,type){
  try{return await cloud.createFile(parent,name,data,type);}catch(e){
   // Una respuesta perdida no equivale a una carga fallida.
   const found=await optional(path(parent,name));if(found)return found;throw e;
  }
 }
 async function workbook(){
  const target=cloud.workbookDestination,dir=target?itemPath(target.drive,target.id):root,name=cloud.bookName||BOOK;
  let book=await optional(path(dir,name));
  if(!book){status('Preparando el Excel compartido…');book=await file(dir,name,await loadTemplate(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}
  if(!book.id||book.folder)throw Error('No se pudo identificar el Excel del registro.');return book;
 }
 async function readJson(item){return request(itemPath(cloud.destination.drive,item.id)+'/content');}
 async function acquire(control,job){
  const lock=await file(control,LOCK,bytes({jobId:job.id,machine:job.snapshot.result.machine,record:job.snapshot.result.recordId,created:job.created}),'application/json');
  const owner=await readJson(lock);
  if(owner.jobId!==job.id)throw Error('Está guardando '+(owner.machine||'otra máquina')+'. Espera a que termine y pulsa Reintentar.');
  return lock;
 }
 async function release(lock){
  const url=itemPath(cloud.destination.drive,lock.id),current=await optional(url);if(!current)return;
  const owner=await readJson(current);if(owner.jobId!==lock.jobId)throw Error('La reserva de guardado cambió. No se ha liberado.');
  await request(url,{method:'DELETE',headers:current.eTag?{'If-Match':current.eTag}:{}});
 }
 async function savePDF(job){
  const result=job.snapshot.result,target=cloud.pdfDestination,dir=target?itemPath(target.drive,target.id):await folder(root,result.machine);
  if(job.pdfId){const saved=await request(itemPath(cloud.pdfDestination?.drive||cloud.destination.drive,job.pdfId));job.pdfUrl=saved.webUrl;remember(job);return;}
  status('Preparando el PDF de las bobinas…');
  // El nombre se reserva antes de cargar para recuperar una respuesta interrumpida.
  if(job.pdfStarted){
   const found=await optional(path(dir,job.pdfName));
   if(found){if(found.size!==job.pdfSize)throw Error('El PDF reservado cambió. Tus datos se conservan para revisar el archivo.');job.pdfId=found.id;job.pdfUrl=found.webUrl;remember(job);return;}
  }
  const data=new Uint8Array(await renderPDF(result,job.created));
  if(!job.pdfStarted){
   const base=scope.CimagrafRecord.filename(result).replace(/\.pdf$/i,'');let name=base+'.pdf',n=2;
   while(await optional(path(dir,name))){if(n>9999)throw Error('No se pudo asignar un nombre al PDF.');name=base+' ('+(n++)+').pdf';}
   job.pdfName=name;
  }
  job.pdfSize=data.byteLength;job.pdfStarted=true;remember(job);
  status('Guardando el PDF en OneDrive…');
  const saved=await file(dir,job.pdfName,data,'application/pdf');
  if(saved.size!==job.pdfSize)throw Error('No se pudo confirmar el PDF completo. Reintenta este registro.');
  job.pdfId=saved.id;job.pdfUrl=saved.webUrl;remember(job);
 }
 async function save(job){
  if(!/^[\w-]{8,80}$/.test(job.id))throw Error('La clave del registro no es válida.');
  const record=scope.CimagrafRecord;
  if(record.missing(job.snapshot.result))throw Error('Completa lote y SAP en todas las bobinas.');
  const control=await folder(root,'_CONTROL_CALCULADORA'),journalDir=await folder(control,'REGISTROS_EXCEL');
  const lock=await acquire(control,job);lock.jobId=job.id;job.lockAcquired=true;job.lockReleased=false;
  let hold=!!job.plan,completed=false;
  try{
   remember(job);
   const book=await workbook(),base=itemPath(cloud.workbookDestination?.drive||cloud.destination.drive,book.id)+'/workbook';
   const sheet=job.snapshot.result.runMode==='production'?'Registros':'Pruebas',table=sheet==='Registros'?'RegistrosBobinas':'PruebasBobinas';
   const tableBase=base+'/tables/'+table,sheetBase=base+'/worksheets/'+sheet;
   const header=await request(tableBase+'/headerRowRange');
   if(JSON.stringify(header.values?.[0])!==JSON.stringify(record.headers))throw Error('Los encabezados del Excel cambiaron. Conserva las columnas del registro antes de reintentar.');
   if(job.kind!=='excel')await savePDF(job);
   const expected=record.rows(job.snapshot.result,job.created,job.id,job.pdfUrl);
   if(!expected.length)throw Error('El registro no contiene movimientos de bobinas.');
   const journalURL=path(journalDir,job.id+'.json');
   let journal=await optional(journalURL),plan;
   if(journal){plan=await readJson(journal);}
   else{
    const range=await request(tableBase+'/range');
    if(range.columnCount!==record.headers.length||range.rowIndex!==0||range.columnIndex!==0)throw Error('La tabla del Excel cambió de ubicación.');
    let start=range.rowCount+1;
    if(range.rowCount===2){const first=await request(sheetBase+"/range(address='A2:Z2')");if(first.values?.[0]?.every(v=>v===''||v===null))start=2;}
    plan={jobId:job.id,bookId:book.id,sheet,table,start,end:start+expected.length-1,rows:expected,created:job.created,pdfId:job.pdfId};
    if(plan.end>1048576)throw Error('El Excel alcanzó su límite de filas.');
    // El diario no se modifica. Reintentar siempre ocupa las mismas celdas.
    hold=true;
    journal=await file(journalDir,job.id+'.json',bytes(plan),'application/json');plan=await readJson(journal);
   }
   if(plan.jobId!==job.id||plan.bookId!==book.id||plan.sheet!==sheet||plan.table!==table||JSON.stringify(plan.rows)!==JSON.stringify(expected))throw Error('Este registro ya tiene una reserva diferente. Conserva los datos y revisa el guardado pendiente.');
   if(!Number.isInteger(plan.start)||plan.start<2||plan.end!==plan.start+expected.length-1)throw Error('La reserva de filas no es válida.');
   job.plan=plan;hold=true;remember(job);
   const target=sheetBase+"/range(address='A"+plan.start+':Z'+plan.end+"')";
   const before=await request(target);
   if((before.values||[]).some(row=>row.some(v=>v!==''&&v!==null)&&!String(row[25]||'').startsWith(job.id+':')))throw Error('Las filas reservadas contienen otro registro. No se ha reemplazado información.');
   let range=await request(tableBase+'/range');
   if(range.rowCount<plan.end){
    // Solo agrega filas vacías: una respuesta tardía nunca duplica movimientos.
    const blanks=Array.from({length:plan.end-range.rowCount},()=>Array(record.headers.length).fill(''));
    await request(tableBase+'/rows/add',json({index:null,values:blanks}));
   }
   status('Guardando los movimientos de OP y bobina en Excel…');
   const formats=expected.map(row=>row.map((_,i)=>record.numericColumns.includes(i)?(i===9||i===10?'0':'0.0'):'@'));
   // Formato primero para conservar SAP/lote con ceros y texto literal.
   await request(target,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({numberFormat:formats})});
   await request(target,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:expected})});
   const check=await request(target);
   if(check.values?.length!==expected.length||expected.some((row,i)=>row.some((v,j)=>!same(check.values[i]?.[j],v))))throw Error('Microsoft no confirmó todos los datos. Reintenta el mismo registro para comprobarlo.');
   job.excelId=book.id;job.excelUrl=book.webUrl;job.saved=true;remember(job);completed=true;
   return job;
  }finally{
   if(completed||!hold){try{await release(lock);job.lockReleased=true;remember(job);}catch(e){if(completed){job.lockReleased=false;remember(job);throw Error('El registro está guardado. Pulsa Reintentar para liberar el turno de Excel.');}throw e;}}
  }
 }
 async function savePDFOnly(job){
  if(scope.CimagrafRecord.missing(job.snapshot.result))throw Error('Completa lote y SAP.');
  await savePDF(job);job.saved=true;job.lockReleased=true;remember(job);return job;
 }
 return {save,savePDF:savePDFOnly};
}
scope.CimagrafExcelStore={create,bookName:BOOK};
})(typeof window==='undefined'?module.exports:window);
