const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const config=fs.readFileSync(path.join(__dirname,'../machine-form.js'),'utf8');
const defs=html.slice(html.indexOf('const GROUP_FORM_KEYS ='),html.indexOf('const EPS=',html.indexOf('const GROUP_FORM_KEYS =')));
const format=html.slice(html.indexOf('function fmt(n)'),html.indexOf('function perOpData('));
const packets=html.slice(html.indexOf('function withdrawalFormAnswers('),html.indexOf('const originalFormsInstructions='));
const prepare=html.slice(html.indexOf('function prepareGroupForms('),html.indexOf('// Catálogo de materiales compartido'));
const engine=html.slice(html.indexOf('function coreTareFor('),html.indexOf('function table(',html.indexOf('function coreTareFor(')));
for(const machine of ['Kirin 1C','Kirin 4C'])for(const mode of ['test','production']){
 const nodes={},nf=String;
 const el=id=>nodes[id]??={value:id==='multi-paper'?'Bond':id==='multi-gsm'?'90':'',classList:{contains:()=>false,add(){}},setAttribute(){},addEventListener(){}};
 const c={window:{},URL,nf,numeric:Number,ops:[{id:'OP-DE-PRUEBA',books:1000,copies:20,advance:240,setupBooks:0,calibration:false,stops:0}],rolls:[{id:'Bobina 1',kg:400,width:480,scrap:0,coreGross:0,coreTare:0}],$:el,document:{body:{classList:{add(){}}}}};
 vm.createContext(c);vm.runInContext(config+engine+';var result=validate();',c);
 const id=(mode==='test'?'PRUEBA · ':'')+machine.toUpperCase()+'-0001';
 Object.assign(c.result,{machine,runMode:mode,recordId:id,group:id,type:'Una OP / una bobina'});
 vm.runInContext(defs+format+packets+prepare+';prepareGroupForms();',c);
 const external=new URL(el('forms-external').href),embedded=new URL(el('forms-frame').src);
 assert.equal(external.searchParams.get('rf61ceca70fda4a82ab4b2ec79e62e708'),machine);
 assert.equal(external.searchParams.get('r170d3c85f72f4039b76d820bf026821b'),id);
 assert.equal(external.searchParams.get('r790012348e2543d18936c9ae9ddb82e7'),id);
 assert.equal(external.searchParams.get('r1a6fb6883bc444629eea97caf2ece32c'),'OP-DE-PRUEBA');
 assert.equal(Number(external.searchParams.get('r6461e1c1fa7f44ccbf714af864bf7fe5')),191.776);
 assert.equal(external.searchParams.getAll('r170d3c85f72f4039b76d820bf026821b').length,1);
 assert.equal(embedded.searchParams.get('embed'),'true');embedded.searchParams.delete('embed');assert.deepEqual([...embedded.searchParams],[...external.searchParams]);
 console.log('OK Precarga real '+machine+' · '+mode+': máquina, ID y cálculos conservados.');
}
