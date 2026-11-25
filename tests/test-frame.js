/* Carga el editor real con almacenamiento y servicios aislados. */
window.CimagrafDemoLocal??=new Map();window.CimagrafDemoSession??=new Map();
window.CimagrafTestFrame={
 async mount(iframe){
  const base=new URL('../',location.href).href,response=await fetch(new URL('index.html?v=5.1.2',base),{cache:'no-store'});
  if(!response.ok)throw Error('No se pudo cargar el editor.');let html=await response.text();
  const isolate='<script>const memory=m=>({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)});Object.defineProperty(window,"localStorage",{value:memory(parent.CimagrafDemoLocal)});Object.defineProperty(window,"sessionStorage",{value:memory(parent.CimagrafDemoSession)});<\/script>';
  html=html.replace('<head>','<head><base href="'+base+'">'+isolate);
  html=html.replace(/(<script src="cloud-excel\.js[^>]+>)/,'<script src="tests/fake-services.js?v=5.1.2"><\/script>$1');
  iframe.srcdoc=html;
 },
 seed(iframe){
  const w=iframe.contentWindow,d=iframe.contentDocument,select=d.getElementById('machine-select');
  if(!select.value){select.value='kirin-1c';select.dispatchEvent(new w.Event('change',{bubbles:true}));}
  const width=d.getElementById('multi-width');width.value=select.value==='kirin-4c'?'469':'480';width.dispatchEvent(new w.Event('change',{bubbles:true}));
  const fields={'[data-op="0"][data-field="id"]':'D13924','[data-op="0"][data-field="books"]':'500','[data-op="0"][data-field="copies"]':'38','[data-op="0"][data-field="advance"]':'240','[data-roll="0"][data-field="lot"]':'76B15226266','[data-roll="0"][data-field="sap"]':'01.01.01.100045','[data-roll="0"][data-field="description"]':'PEFC 70% CHAMBRIL DIGITAL (IMP)','[data-roll="0"][data-field="kg"]':'400','[data-roll="0"][data-field="scrap"]':'5','[data-roll="0"][data-field="coreGross"]':'10'};
  for(const [selector,value] of Object.entries(fields)){const el=d.querySelector(selector);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));}
 }
};
