const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const config=fs.readFileSync(path.join(__dirname,'../machine-form.js'),'utf8');
const defs=html.slice(html.indexOf('const GROUP_FORM_KEYS ='),html.indexOf('const EPS=',html.indexOf('const GROUP_FORM_KEYS =')));
const format=html.slice(html.indexOf('function fmt(n)'),html.indexOf('function perOpData('));
const packets=html.slice(html.indexOf('function withdrawalFormAnswers('),html.indexOf('const originalFormsInstructions='));
const prepare=html.slice(html.indexOf('function prepareGroupForms('),html.indexOf('// Catálogo de materiales compartido'));
const engine=html.slice(html.indexOf('function coreTareFor('),html.indexOf('function table(',html.indexOf('function coreTareFor(')));
const show=html.slice(html.indexOf('function show(){',html.indexOf('function renderRollUsage(')),html.indexOf('function buildPrintSummary('));
for(const machine of ['Kirin 1C','Kirin 4C'])for(const mode of ['test','production']){
 const nodes={},events={},nf=String;
 const el=id=>nodes[id]??={value:id==='multi-paper'?'Bond':id==='multi-gsm'?'90':'',classList:{contains:()=>false,add(){}},setAttribute(){},addEventListener(event,fn){events[id+':'+event]=fn;},replaceChildren(){}};
 const id=(mode==='test'?'PRUEBA · ':'')+machine.toUpperCase()+' - 01';
 const metadata={machine,machineKey:machine==='Kirin 4C'?'kirin-4c':'kirin-1c',runMode:mode,recordId:id};
 el('multi-group').value=id;
 const c={window:{CimagrafProduction:{metadata:()=>metadata}},URL,nf,numeric:Number,EPS:1e-8,result:null,confirmedOps:new Set(),table(){return '';},renderRollUsage(){},refreshOpQueue(){},ops:[{id:'OP-DE-PRUEBA',books:1000,copies:20,advance:240,setupBooks:1,calibration:true,stops:1}],rolls:[{id:'Bobina 1',kg:400,width:480,scrap:0,coreGross:0,coreTare:0}],$:el,document:{body:{classList:{add(){}}}}};
 vm.createContext(c);vm.runInContext(config+engine+show+';show();',c);
 assert.equal(c.result.machineKey,metadata.machineKey);
 assert.equal(c.result.sums[0].calibrationMeters,machine==='Kirin 4C'?19:26);
 vm.runInContext(defs+format+packets+prepare+';prepareGroupForms();',c);
 const external=new URL(el('forms-external').href),embedded=new URL(el('forms-frame').src);
 assert.equal(external.searchParams.get('rf61ceca70fda4a82ab4b2ec79e62e708'),machine);
 assert.equal(external.searchParams.get('r170d3c85f72f4039b76d820bf026821b'),id);
 assert.equal(external.searchParams.get('r790012348e2543d18936c9ae9ddb82e7'),id);
 assert.equal(external.searchParams.get('r1a6fb6883bc444629eea97caf2ece32c'),'OP-DE-PRUEBA');
 assert.equal(Number(external.searchParams.get('r6461e1c1fa7f44ccbf714af864bf7fe5')),machine==='Kirin 4C'?189.41728:188.51008);
 assert.equal(external.searchParams.getAll('r170d3c85f72f4039b76d820bf026821b').length,1);
 assert.equal(embedded.searchParams.get('embed'),'true');embedded.searchParams.delete('embed');assert.deepEqual([...embedded.searchParams],[...external.searchParams]);
 console.log('OK Precarga real '+machine+' · '+mode+': máquina, ID y cálculos conservados.');
 if(machine==='Kirin 1C'&&mode==='test'){
  const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
  const scheduler=html.slice(html.indexOf('let autoQueued=false;'),html.indexOf('function fmt(n)'));
  const {CimagrafRegistry}=require('../machine-registry.js');
  Object.assign(c,{localStorage:storage(),sessionStorage:storage(),crypto:require('node:crypto').webcrypto,queueMicrotask:fn=>fn()});
  Object.assign(c.document,{getElementById:el,addEventListener(){}});
  Object.assign(c.window,{CimagrafRegistry,addEventListener(){},CimagrafArchive:{refresh:()=>vm.runInContext('scheduleAuto()',c)}});
  for(const node of Object.values(nodes))node.classList.toggle=()=>{};
  // Render crea otros nodos del selector; el estilo de cada uno es independiente.
  for(const id of ['machine-status','machine-mode'])el(id).classList.toggle=()=>{};
  vm.runInContext(scheduler,c);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../production.js'),'utf8'),c);
  for(const [key,saldo] of [['kirin-1c',188.51008],['kirin-4c',189.41728],['kirin-1c',188.51008]]){
   el('machine-select').value=key;events['machine-select:change']();
   assert.equal(c.result.machineKey,key);
   assert.ok(Math.abs(c.result.saldo-saldo)<1e-7);
   assert.match(el('multi-delivery').innerHTML,/delivery-unit/);
  }
  console.log('OK El selector recalcula el mismo trabajo al cambiar de máquina y al volver.');
 }
}
