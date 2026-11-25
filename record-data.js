/* El rótulo y Excel parten del mismo resultado, sin recalcular ni redondear los kg. */
(function(scope){
'use strict';
const headers=['Fecha','Hora','Máquina','Registro','OP','Bobina','Lote','SAP','Material','Gramaje (g/m²)','Ancho (mm)','Inicio (kg)','Producción (kg)','Descuentos (kg)','Saldo (kg)','Devolución final (kg)','Metros','Lonjas (kg)','Sobrante papel (kg)','Proceso (kg)','Motivo lonjas','Área involucrada','Descripción del rótulo','PDF','Modo','Clave registro'];
const numericColumns=[9,10,11,12,13,14,15,16,17,18,19];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dateParts(created){
 const date=new Date(created);if(!Number.isFinite(date.getTime()))throw Error('La fecha del registro no es válida.');
 return {date:new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'2-digit',year:'numeric'}).format(date),time:new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date)};
}
function movements(r){
 const rows=[];
 for(const bobbin of r.usedRolls){
  const moves=r.details.filter(d=>d.bobina===bobbin.id);
  let opening=bobbin.initial;
  const entries=moves.length?moves:[{op:r.sourceOps[0]?.id||'—',productiveKg:0,processKg:0,metros:0,saldo:bobbin.left}];
  entries.forEach((move,index)=>{
   const first=index===0,last=index===entries.length-1;
   const retired=first?Number(bobbin.retired||0):0,core=first?Number(bobbin.corePaper||0):0;
   const process=Number(move.processKg||0),production=Number(move.productiveKg??move.kg??0),deductions=process+retired+core;
   if(Math.abs(opening-production-deductions-move.saldo)>1e-6)throw Error('El movimiento de '+bobbin.id+' no concilia.');
   rows.push({bobbin,op:move.op,opening,production,process,retired,core,deductions,meters:move.metros||0,balance:move.saldo,final:last?bobbin.left:0,last,first});
   opening=move.saldo;
  });
 }
 return rows;
}
// Texto literal: preserva ceros iniciales e impide fórmulas al escribir valores externos.
const excelText=value=>{const s=String(value??'');return /^[=+\-@]/.test(s)?"'"+s:s;};
function rows(r,created,jobId,pdfUrl=''){
 const stamp=dateParts(created);
 return movements(r).map((m,i)=>{
  const b=m.bobbin;
  return [stamp.date,stamp.time,r.machine,r.recordId||r.group,m.op,b.id,b.lot,b.sap,r.paper,r.gsm,b.width,m.opening,m.production,m.deductions,m.balance,m.final,m.meters,m.retired,m.core,m.process,m.first?(b.problems||[]).join('; '):'',m.first?(b.areas||[]).join('; '):'',b.description||'',pdfUrl,r.runMode==='production'?'PRODUCCIÓN':'PRUEBA',jobId+':'+(i+1)].map((v,index)=>numericColumns.includes(index)?Number(v):excelText(v));
 });
}
function missing(r){return r.loads.find(b=>!String(b.lot??'').trim()||!String(b.sap??'').trim());}
function labelHTML(r,created,logo=''){
 const stamp=dateParts(created),returned=r.usedRolls.filter(b=>b.left>1e-8);
 const nf=value=>new Intl.NumberFormat('es-PE',{minimumFractionDigits:1,maximumFractionDigits:1}).format(value);
 return returned.map(b=>{
  const ops=[...new Set(r.details.filter(m=>m.bobina===b.id).map(m=>m.op))];
  if(!ops.length&&r.sourceOps[0])ops.push(r.sourceOps[0].id);
  const lot=esc(b.lot),sap=esc(b.sap),description=esc(b.description||'');
  const compact=(ops.join(' / ').length>38||String(b.description||'').length>70||String(b.sap).length>25||String(b.lot).length>30)?' label-compact':'';
  return '<article class="bobbin-label'+compact+'"><div class="label-top">'+(logo.startsWith('data:image/png;base64,')?'<img class="label-logo" alt="Cimagraf" src="'+esc(logo)+'">':'')+'<div class="label-machine">'+esc(r.machine)+' · '+esc(b.id)+'</div></div>'
   +'<div class="label-body"><p class="label-caption">CÓDIGO SAP</p><p class="label-sap">'+sap+'</p>'
   +'<p class="label-material">'+esc(r.paper.toUpperCase())+' · '+esc(r.gsm)+' g/m²</p>'
   +'<p class="label-width">ANCHO: '+esc(b.width)+' mm</p>'
   +(description?'<div class="label-description"><span>Descripción adicional</span><strong>'+description+'</strong></div>':'')
   +'<p class="label-op">OP: '+esc(ops.join(' / '))+'</p>'
   +'<p class="label-lot">LOTE: '+lot+'</p>'
   +'<p class="label-weight">'+nf(b.left)+' kg</p>'
   +'<p class="label-date">FECHA: '+stamp.date+'</p></div><small>Peso neto de papel calculado · '+esc(r.recordId||r.group||'')+'</small></article>';
 }).join('');
}
function filename(r,extension='pdf'){
 const clean=value=>String(value??'').replace(/["*:<>?\/\\|#%\u0000-\u001f]/g,'-').trim().replace(/[. ]+$/g,'');
 const ops=Array.from([...new Set(r.sourceOps.map(o=>clean(o.id)))].join('_')).slice(0,130).join('').replace(/[. ]+$/g,'');
 return ops+'_'+clean(r.machine).replace(/\s+/g,'').toUpperCase()+'.'+extension;
}
scope.CimagrafRecord={headers,numericColumns,dateParts,movements,rows,missing,labelHTML,filename};
})(typeof window==='undefined'?module.exports:window);
