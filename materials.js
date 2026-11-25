/* Catálogo de papel y gramaje del equipo. */
(function(){
'use strict';
const $=id=>document.getElementById(id),key='consumo-bobina-materiales-v1';
const defaults=[{name:'Bond',gsm:90},{name:'Book Cream',gsm:70}];
const clean=name=>{const value=String(name??'').trim().replace(/\s+/g,' ');return /^book\s*crim$/i.test(value)?'Book Cream':value;};
const same=(a,b)=>clean(a).toLocaleLowerCase()===clean(b).toLocaleLowerCase();
let catalog=[],launcher;
try{const saved=JSON.parse(localStorage.getItem(key));if(Array.isArray(saved))catalog=saved;}catch(_){}
catalog=[...catalog,...defaults].reduce((items,entry)=>{
 if(!entry||typeof entry.name!=='string')return items;
 const name=clean(entry.name),gsm=Number(entry.gsm);
 if(name&&Number.isFinite(gsm)&&gsm>0&&!items.some(e=>same(e.name,name)&&e.gsm===gsm))items.push({name:items.find(e=>same(e.name,name))?.name||name,gsm});
 return items;
},[]);
const notify=detail=>document.dispatchEvent(new CustomEvent('cimagraf-materials-changed',{detail}));
const save=()=>{try{localStorage.setItem(key,JSON.stringify(catalog));return true;}catch(_){return false;}};
const isDefault=e=>defaults.some(d=>same(d.name,e.name)&&d.gsm===e.gsm);
function render(){
 const list=$('material-custom-list');list.replaceChildren();
 const added=catalog.filter(e=>!isDefault(e)).sort((a,b)=>a.name.localeCompare(b.name,'es')||a.gsm-b.gsm);
 if(!added.length){const li=document.createElement('li');li.textContent='Aún no hay opciones agregadas.';list.append(li);}
 for(const entry of added){
  const li=document.createElement('li'),span=document.createElement('span'),button=document.createElement('button');
  span.textContent=entry.name+' · '+entry.gsm+' g/m²';button.type='button';button.className='catalog-remove';button.textContent='Eliminar';button.setAttribute('aria-label','Eliminar '+span.textContent);
  button.addEventListener('click',()=>{catalog=catalog.filter(e=>e!==entry);const stored=save();render();notify();$('material-catalog-status').textContent=stored?'Opción eliminada.':'Opción eliminada en esta sesión.';($('material-custom-list').querySelector('button')||$('cancel-material')).focus();});
  li.append(span,button);list.append(li);
 }
}
function close(){
 $('material-modal').classList.remove('open');$('material-form').reset();$('material-error').textContent='';launcher?.focus();
}
function open(button,name){
 launcher=button;$('material-form').reset();$('new-name').value=name||'';$('material-name-suggestions').replaceChildren();
 for(const n of new Set(catalog.map(e=>e.name))){const option=document.createElement('option');option.value=n;$('material-name-suggestions').append(option);}
 render();$('material-error').textContent='';$('material-catalog-status').textContent='';$('material-modal').classList.add('open');$('new-gsm').focus();
}
$('cancel-material').addEventListener('click',close);
$('material-modal').addEventListener('click',e=>{if(e.target===$('material-modal'))close();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('material-modal').classList.contains('open'))close();});
$('material-form').addEventListener('submit',e=>{
 e.preventDefault();let name=clean($('new-name').value);const gsm=Number($('new-gsm').value);
 if(!name||!Number.isFinite(gsm)||gsm<=0){$('material-error').textContent='Ingresa papel y gramaje mayor que cero.';return;}
 name=catalog.find(x=>same(x.name,name))?.name||name;
 if(catalog.some(x=>same(x.name,name)&&x.gsm===gsm)){$('material-error').textContent='Ese papel y gramaje ya existen.';return;}
 catalog.push({name,gsm});save();notify({name,gsm});close();
});
window.CimagrafMaterials={entries:()=>catalog.slice(),open};
})();
