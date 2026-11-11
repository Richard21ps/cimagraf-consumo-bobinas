const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const helpers=html.slice(html.indexOf("$('multi-add-roll').addEventListener"),html.indexOf('function mode(useMulti)'));
const engine=html.slice(html.indexOf('function coreTareFor('),html.indexOf('\nfunction table('));
function fixture(saved={},machine='kirin-1c'){
 const nodes={};const memory=new Map(Object.entries(saved));
 const $=id=>nodes[id]??=( {value:'',hidden:true,options:[],validity:{badInput:false},events:{},addEventListener(k,f){this.events[k]=f},replaceChildren(){this.options=[]},add(o){this.options.push(o)},setAttribute(k,v){this[k]=v},focus(){}} );
 const c={$,rolls:[{id:'A',kg:200,width:'',scrap:5,coreGross:10,coreTare:''},{id:'B',kg:200,width:'',scrap:0,coreGross:0,coreTare:''}],ops:[{id:'OP1',books:100,copies:30,advance:240,setupBooks:0,calibration:false,stops:0}],localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},Option:function(text,value){Object.assign(this,{text,value})},markDirty(){},redraw(){},scheduleAuto(){},numeric:x=>x===''?NaN:Number(x),nf:String};
 $('multi-paper').value='Bond';$('multi-gsm').value='90';vm.createContext(c);vm.runInContext(helpers+'\nrenderWidthOptions(); syncWidthMachine('+JSON.stringify(machine)+');',c);
 return {c,$,memory,run:s=>vm.runInContext(s,c),fire:(id,event)=>$(id).events[event]({preventDefault(){}}),options:()=>$('multi-width').options.map(o=>o.value)};
}
let n=0;function test(name,fn){fn();n++;console.log('OK '+name)}
test('Catálogo ordenado, sin duplicados; datos guardados inválidos no afectan el formulario',()=>{
 for(const saved of ['bad','{}','[660,480,600,600,-1,null,true,"700","abc"]']){const f=fixture({'cimagraf-widths-v2:kirin-1c':saved});assert.deepEqual(f.options(),saved.startsWith('[')?['','480','600','640','660','700']:['','480','640','660']);assert.equal(f.$('multi-width').value,'');}
});
test('Agregar ancho aplica a todas, ordena, persiste y no duplica',()=>{
 const f=fixture();f.$('width-new').value='600';f.fire('width-form','submit');assert.deepEqual(f.options(),['','480','600','640','660']);assert.ok(f.c.rolls.every(r=>r.width==='600'));assert.equal(f.$('width-form').hidden,true);
 f.$('width-new').value='600';f.fire('width-form','submit');assert.equal(f.options().filter(v=>v==='600').length,1);assert.ok(fixture(Object.fromEntries(f.memory)).options().includes('600'));
 f.fire('multi-add-roll','click');assert.equal(f.c.rolls[2].width,'600');
});
test('Anchos vacíos, negativos e inválidos no cambian el registro',()=>{for(const v of ['',0,-1,'abc','Infinity']){const f=fixture();f.$('width-new').value=String(v);f.fire('width-form','submit');assert.equal(f.$('width-error').hidden,false);assert.ok(f.c.rolls.every(r=>r.width===''));assert.equal(f.options().length,4);}});
test('Cambio común recalcula consumo y tara; conserva el balance de kg',()=>{
 const f=fixture();f.c.rolls=f.c.rolls.slice(0,1);f.run(engine);f.run('applyCommonWidth(480)');let a=f.run('validate()');assert.ok(Math.abs(a.loads[0].corePaper-9.01)<1e-8);assert.ok(Math.abs(a.total-31.968)<1e-8);
 f.$('multi-width').value='640';f.fire('multi-width','change');let b=f.run('validate()');assert.ok(Math.abs(b.loads[0].corePaper-8.68)<1e-8);assert.ok(Math.abs(b.total-42.624)<1e-8);assert.ok(Math.abs(b.saldo-(200-5-8.68-42.624))<1e-8);
});
test('Pendientes antiguos conservan los anchos hasta seleccionar uno común',()=>{
 const f=fixture();f.c.rolls[0].width='480';f.c.rolls[1].width='640';f.run('restoreWidthSelection()');assert.equal(f.$('multi-width').value,'__mixed__');assert.equal(f.$('width-legacy-note').hidden,false);assert.equal(f.c.rolls[0].width,'480');
 f.run('applyCommonWidth(660)');assert.ok(f.c.rolls.every(r=>r.width==='660'));assert.equal(f.$('width-legacy-note').hidden,true);
 f.c.rolls.forEach(r=>r.width='700');f.run('restoreWidthSelection()');assert.equal(f.$('multi-width').value,'700');
});
test('Limpiar selección vacía los anchos sin perder el catálogo añadido',()=>{const f=fixture({'cimagraf-widths-v2:kirin-1c':'[600]'});f.run('applyCommonWidth(600)');f.$('multi-width').value='';f.fire('multi-width','change');assert.ok(f.c.rolls.every(r=>r.width===''));assert.ok(f.options().includes('600'));});
test('Cada Kirin conserva sus anchos; cambiar de máquina limpia el ancho aplicado',()=>{
 const f=fixture({'cimagraf-widths-v1':'[720]'},'');
 assert.deepEqual(f.options(),['']);assert.equal(f.$('multi-width').disabled,true);
 f.run("syncWidthMachine('kirin-1c')");assert.deepEqual(f.options(),['','480','640','660']);
 f.run('applyCommonWidth(640)');f.fire('multi-add-roll','click');
 f.run("syncWidthMachine('kirin-4c')");assert.deepEqual(f.options(),['','469']);assert.equal(f.$('multi-width').value,'');
 assert.ok(f.c.rolls.every(r=>r.width===''));assert.equal(f.run('applyCommonWidth(640)'),false);
 f.$('width-new').value='500';f.fire('width-form','submit');assert.deepEqual(f.options(),['','469','500']);
 f.run("syncWidthMachine('kirin-1c')");assert.deepEqual(f.options(),['','480','640','660']);
 assert.deepEqual(fixture(Object.fromEntries(f.memory),'kirin-4c').options(),['','469','500']);
});
console.log(n+' pruebas de ancho común correctas.');
