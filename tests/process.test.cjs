const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function coreTareFor('),end=html.indexOf('\nfunction table(',start);
const engine=html.slice(start,end);
const base={id:'OP1',books:100,copies:30,advance:240,setupCopies:10,calibration:true,stops:2};
const roll=(kg=200,width=1000,scrap=0,coreGross=0)=>({id:'Bobina 1',kg,width,scrap,coreGross,coreTare:1});
function calculate(ops=[base],rolls=[roll()],paper='Otro papel',gsm=100){
 const c={ops:structuredClone(ops),rolls:rolls.map((r,i)=>({...r,id:'Bobina '+(i+1)})),numeric:x=>x===''?NaN:Number(x),nf:String,$:id=>({value:id==='multi-gsm'?String(gsm):paper})};
 vm.createContext(c);return vm.runInContext(engine+';validate()',c);
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
let count=0;function test(name,fn){fn();count++;console.log('OK '+name);}
test('Ejemplo confirmado: set up 200 m, calibración 60 m, dos paradas 54.4 m',()=>{
 const r=calculate(),s=r.sums[0];near(s.productionMeters,720);near(s.setupMeters,200);near(s.calibrationMeters,60);near(s.stopMeters,54.4);near(s.spliceMeters,20);near(s.metros,1054.4);near(r.total,105.44);near(r.saldo,94.56);near(r.totalProductive,72);near(r.totalProcess,33.44);
});
test('Sin calibración no agrega 6 m; set up y paradas siguen independientes',()=>{const r=calculate([{...base,calibration:false}]);near(r.sums[0].setupMeters,200);near(r.sums[0].calibrationMeters,0);near(r.saldo,100.56);});
test('Cero set up y cero paradas mantiene empalme obligatorio de 20 m',()=>{const r=calculate([{...base,setupCopies:0,stops:0}]);near(r.sums[0].metros,740);near(r.totalProcess,2);});
test('3 OP / 2 bobinas: empalme de 60 m, no 100 m',()=>{const ops=Array.from({length:3},(_,i)=>({...base,id:'OP'+i,setupCopies:0,calibration:false,stops:0}));const r=calculate(ops,[roll(),roll()]);near(r.spliceMeters,60);near(r.sums.reduce((s,o)=>s+o.spliceMeters,0),60);});
test('2 OP / 3 bobinas: empalme de 60 m, no 100 m',()=>{const ops=Array.from({length:2},(_,i)=>({...base,id:'OP'+i,setupCopies:0,calibration:false,stops:0}));const r=calculate(ops,[roll(),roll(),roll()]);near(r.spliceMeters,60);near(r.sums[0].spliceMeters,20);near(r.sums[1].spliceMeters,40);});
test('Asignación por etapas y por ancho real: conserva metros y cada kg',()=>{
 const r=calculate([base],[roll(30,1000,2),roll(100,500,3)]);
 // 280 m en la primera: 200 de set up + 60 calibración + 20 empalme.
 near(r.loads[0].processKg,28);near(r.loads[0].productiveKg,0);near(r.loads[0].left,0);
 near(r.loads[1].productiveKg,36);near(r.loads[1].processKg,(20+54.4)*.05);
 near(r.sums[0].spliceMeters,40);near(r.saldo,57.28);
 for(const b of r.loads)near(b.initial,b.scrap+b.productiveKg+b.processKg+b.left);
 for(const d of r.details){near(d.metros,d.productionMeters+d.setupMeters+d.calibrationMeters+d.spliceMeters+d.stopMeters);near(d.kg,d.productiveKg+d.processKg);near(d.kg,d.metros*d.ancho*100/1e6);}
});
test('Setup, calibración y paradas diferentes por OP',()=>{const r=calculate([{...base,id:'A'},{...base,id:'B',setupCopies:3,calibration:false,stops:0}],[roll(400)]);near(r.sums[0].stopMeters,54.4);near(r.sums[1].setupMeters,60);near(r.sums[1].calibrationMeters,0);near(r.sums[1].stopMeters,0);});
test('Material justo, saldo cero e insuficiencia por descuentos de proceso',()=>{near(calculate([base],[roll(105.44)]).saldo,0);assert.throws(()=>calculate([base],[roll(105.43)]),/Material insuficiente/);});
test('Validación: no permite negativos, fracciones, vacíos ni NaN',()=>{for(const key of ['setupCopies','stops'])for(const value of [-1,.5,'',NaN,Infinity])assert.throws(()=>calculate([{...base,[key]:value}]),/enteras/);assert.throws(()=>calculate([{...base,calibration:'false'}]),/calibración/);});
test('Lonjas y tuco se descuentan una vez además del proceso',()=>{const r=calculate([base],[roll(200,480,5,10)],'Bond',90);near(r.loads[0].corePaper,9.01);near(r.loads[0].scrap,14.01);near(r.total,1054.4*.0432);near(r.saldo,200-14.01-1054.4*.0432);});
test('Paquete Forms conserva nueve columnas iniciales y amplía el detalle',()=>{const r=calculate();const a=html.indexOf('function groupText('),b=html.indexOf('const originalFormsInstructions',a);const c={r,fmt:String};vm.createContext(c);const packet=vm.runInContext(html.slice(a,b)+';groupText(r)',c);const cols=packet.split('||')[1].split('~');assert.equal(cols[0],'OP1');assert.equal(cols[2],'30');assert.equal(cols.length,19);assert.equal(cols[9],'10');assert.equal(cols[10],'1');assert.equal(cols[11],'2');near(Number(cols[4]),1054.4);near(Number(cols[6]),94.56);});
console.log(count+' pruebas de proceso correctas.');
