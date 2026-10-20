(() => {
'use strict';
const $=id=>document.getElementById(id);
const root=$('multi-root'), simple=$('simple-mode'), complex=$('multi-mode'), layout=document.querySelector('.layout');
if(!root||!simple||!complex||!layout)return;
const KEY='cimagraf-multi-sesiones-v1', EPS=1e-8;
let ops=[{id:'',books:'',copies:'',advance:''}], rolls=[{id:'',kg:''}], result=null;
const nf=(x,d=3)=>new Intl.NumberFormat('es-PE',{maximumFractionDigits:d}).format(x);
const numeric=x=>x===''?NaN:Number(x);
const field=(title,value,attr)=>'<label>'+title+'<input '+attr+' value="'+escapeHtml(value)+'"></label>';
function escapeHtml(v){return String(v??'').replace(/[&"'<>]/g,c=>({'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[c]));}
function markDirty(){result=null;$('multi-results').hidden=true;$('multi-error').hidden=true;$('multi-success').hidden=true;}
function redraw(){
 $('multi-op-list').innerHTML=ops.map((o,i)=>'<div class="multi-row"><div class="multi-row-head"><strong>OP '+(i+1)+'</strong><button class="multi-remove" data-kind="op" data-remove="'+i+'" type="button" '+(ops.length===1?'disabled':'')+'>Quitar OP</button></div><div class="multi-row-fields">'+field('Número de OP',o.id,'data-op="'+i+'" data-field="id" placeholder="OP" maxlength="45"')+field('Cantidad de libros',o.books,'type="number" min="1" step="1" data-op="'+i+'" data-field="books"')+field('Copias por libro',o.copies,'type="number" min="1" step="1" data-op="'+i+'" data-field="copies"')+field('Avance por copia (mm)',o.advance,'type="number" min="0" step="any" data-op="'+i+'" data-field="advance"')+'</div></div>').join('');
 $('multi-roll-list').innerHTML=rolls.map((o,i)=>'<div class="multi-row"><div class="multi-row-head"><strong>Bobina '+(i+1)+(i===0?' · Primera en uso':'')+'</strong><button class="multi-remove" data-kind="roll" data-remove="'+i+'" type="button" '+(rolls.length===1?'disabled':'')+'>Quitar bobina</button></div><div class="multi-row-fields">'+field('Identificador de bobina',o.id,'data-roll="'+i+'" data-field="id" placeholder="Ej.: B-001" maxlength="45"')+field('Kg iniciales',o.kg,'type="number" min="0" step="any" data-roll="'+i+'" data-field="kg"')+'</div></div>').join('');
}
root.addEventListener('input',e=>{
 const t=e.target, type=t.dataset.op!==undefined?'op':t.dataset.roll!==undefined?'roll':null;
 if(type){const idx=Number(t.dataset[type]); (type==='op'?ops:rolls)[idx][t.dataset.field]=t.value;}
 markDirty();
});
root.addEventListener('change',markDirty);
root.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 const remove=b.dataset.remove;
 if(remove!==undefined){const data=b.dataset.kind==='op'?ops:rolls;if(data.length>1){data.splice(Number(remove),1);markDirty();redraw();}}
});
$('multi-add-op').addEventListener('click',()=>{ops.push({id:'',books:'',copies:'',advance:''});markDirty();redraw();});
$('multi-add-roll').addEventListener('click',()=>{rolls.push({id:'',kg:''});markDirty();redraw();});
function mode(useMulti){layout.hidden=useMulti;root.hidden=!useMulti;simple.setAttribute('aria-pressed',String(!useMulti));complex.setAttribute('aria-pressed',String(useMulti));}
simple.addEventListener('click',()=>mode(false));complex.addEventListener('click',()=>mode(true));
function validate(){
 const width=numeric($('multi-width').value),gsm=numeric($('multi-gsm').value),paper=$('multi-paper').value.trim();
 if(!paper||!Number.isFinite(width)||width<=0||!Number.isFinite(gsm)||gsm<=0)throw Error('Revisa el material, el ancho y el gramaje. Todos deben ser válidos y mayores que cero.');
 const rollIds=new Set(),opIds=new Set();
 for(const r of rolls){r.id=r.id.trim();const kg=numeric(r.kg);if(!r.id||!Number.isFinite(kg)||kg<=0)throw Error('Completa el identificador y los kg iniciales de todas las bobinas.');if(rollIds.has(r.id.toLocaleLowerCase()))throw Error('El identificador de cada bobina debe ser único.');rollIds.add(r.id.toLocaleLowerCase());}
 for(const o of ops){o.id=o.id.trim();const b=numeric(o.books),c=numeric(o.copies),a=numeric(o.advance);if(!o.id||!Number.isInteger(b)||b<=0||!Number.isInteger(c)||c<=0||!Number.isFinite(a)||a<=0)throw Error('Completa las OP con cantidades enteras y avance positivo.');if(opIds.has(o.id.toLocaleLowerCase()))throw Error('No dupliques una misma OP: registra su producción total en una fila.');opIds.add(o.id.toLocaleLowerCase());}
 const rate=width*gsm/1000000;
 const loads=rolls.map(r=>({id:r.id,initial:numeric(r.kg),left:numeric(r.kg),used:0}));
 const details=[],sums=[],tol=1e-9;
 let ri=0,consumedTotal=0;
 for(const o of ops){
  // Misma fórmula que el modo sencillo: metros=libros*copias*avance/1000; kg=metros*ancho*gramaje/1e6.
  const meters=numeric(o.books)*numeric(o.copies)*numeric(o.advance)/1000;
  const demand=meters*rate;
  if(!Number.isFinite(demand)||demand<=0)throw Error('Los datos de '+o.id+' producen un consumo no válido.');
  let pending=demand;let guard=0;
  while(pending>tol){
   if(++guard>loads.length+2)throw Error('No se pudo distribuir el consumo de '+o.id+'.');
   const r=loads[ri];if(!r)throw Error('Material insuficiente: la OP '+o.id+' necesita '+nf(pending)+' kg adicionales. Agrega una bobina.');
   const used=Math.min(r.left,pending);
   if(used<=tol){r.left=0;ri++;continue;}
   r.used+=used;r.left=Math.max(0,r.initial-r.used);
   pending=Math.max(0,pending-used);
   details.push({op:o.id,bobina:r.id,kg:used,metros:used/rate,saldo:r.left,seq:details.length+1});
   // Pasamos a otra bobina únicamente cuando el saldo es cero (tolerancia de cálculo).
   if(r.left<=tol){r.left=0;ri++;}
  }
  sums.push({op:o.id,kg:demand,metros:meters});
  consumedTotal+=demand;
 }
 const usedRolls=loads.filter(r=>r.used>tol);
 const saldo=usedRolls.reduce((a,r)=>a+r.left,0);
 return {paper,gsm,width,details,sums,loads,usedRolls,total:consumedTotal,saldo};
}
function table(headers,rows){return '<div class="multi-table-wrap"><table class="multi-table"><thead><tr>'+headers.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((cell,i)=>'<td'+(i?' class="num"':'')+'>'+escapeHtml(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function show(){
 try{
  const r=validate();result=r;$('multi-error').hidden=true;$('multi-success').hidden=false;
  $('multi-success').textContent='Cálculo correcto. La asignación de bobinas es secuencial y no se ha duplicado ningún peso inicial.';
  $('multi-results').hidden=false;
  $('multi-total').textContent=nf(r.total)+' kg';$('multi-saldo').textContent=nf(r.saldo)+' kg';$('multi-active').textContent=r.usedRolls.at(-1)?.id||'—';
  $('multi-ops-table').innerHTML=table(['OP','Kg consumidos','Metros consumidos'],r.sums.map(x=>[x.op,nf(x.kg),nf(x.metros,2)]));
  $('multi-rolls-table').innerHTML=table(['Bobina','Kg iniciales','Kg consumidos','Kg restantes','Estado'],r.loads.map(x=>[x.id,nf(x.initial),nf(x.used),nf(x.left),x.used<=EPS?'Sin utilizar':x.left<=EPS?'Agotada':'Con saldo']));
  $('multi-trace-table').innerHTML=table(['Secuencia','OP','Bobina','Kg consumidos','Metros','Saldo después (kg)'],r.details.map(x=>[x.seq,x.op,x.bobina,nf(x.kg),nf(x.metros,2),nf(x.saldo)]));
 }catch(err){result=null;$('multi-results').hidden=true;$('multi-success').hidden=true;$('multi-error').textContent=err.message;$('multi-error').hidden=false;}
}
$('multi-calculate').addEventListener('click',show);
function csvField(v){const s=String(v??'');return /[;"\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function exportCsv(rows){const data='\ufeff'+rows.map(r=>r.map(csvField).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Cimagraf_trazabilidad_OP_bobinas.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
$('multi-export').addEventListener('click',()=>{
 if(!result){$('multi-error').textContent='Primero calcula la distribución actual antes de exportar.';$('multi-error').hidden=false;return;}
 const r=result;
 const rows=[['Grupo','Secuencia','OP','Bobina','Papel','Gramaje g/m²','Ancho mm','Kg consumidos','Metros consumidos','Saldo bobina kg']];
 const group=$('multi-group').value.trim()||'GRUPO-SIN-ID';
 r.details.forEach(d=>rows.push([group,d.seq,d.op,d.bobina,r.paper,r.gsm,r.width,d.kg.toFixed(6),d.metros.toFixed(6),d.saldo.toFixed(6)]));
 exportCsv(rows);
});
redraw();mode(false);
})();