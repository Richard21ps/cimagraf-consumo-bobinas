const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function coreTareFor('),end=html.indexOf('\nfunction table(',start);
const engine=html.slice(start,end);
const base={id:'OP1',books:100,copies:30,advance:240,setupBooks:10,calibration:true,stops:2};
const roll=(kg=200,width=1000,scrap=0,coreGross=0)=>({id:'Bobina 1',kg,width,scrap,coreGross,coreTare:1});
function calculate(ops=[base],rolls=[roll()],paper='Otro papel',gsm=100,machineKey='kirin-1c'){
 const c={machineKey,ops:structuredClone(ops),rolls:rolls.map((r,i)=>({...r,id:'Bobina '+(i+1)})),numeric:x=>x===''?NaN:Number(x),nf:String,$:id=>({value:id==='multi-gsm'?String(gsm):paper})};
 vm.createContext(c);return vm.runInContext(engine+';validate(machineKey)',c);
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
let count=0;function test(name,fn){fn();count++;console.log('OK '+name);}
test('Libros de set up y corrida comparten copias: 272 m, 720 m y calibración de 26 m',()=>{
 const r=calculate(),s=r.sums[0];near(s.productionMeters,720);near(s.setupMeters,272);near(s.calibrationMeters,26);near(s.stopMeters,54.4);near(s.spliceMeters,20);near(s.metros,1092.4);near(r.total,109.24);near(r.saldo,90.76);near(r.totalProductive,72);near(r.totalProcess,37.24);
});
test('Sin calibración no agrega 26 m; set up y paradas siguen independientes',()=>{const r=calculate([{...base,calibration:false}]);near(r.sums[0].setupMeters,272);near(r.sums[0].calibrationMeters,0);near(r.saldo,93.36);});
test('Calibración es independiente del set up: cero libros de set up también suma 26 m',()=>{const r=calculate([{...base,setupBooks:0,stops:0}]);near(r.sums[0].setupMeters,0);near(r.sums[0].calibrationMeters,26);near(r.sums[0].metros,766);near(r.totalProcess,4.6);const n=calculate([{...base,setupBooks:0,stops:0,calibration:false}]);near(n.sums[0].metros,740);near(r.total-n.total,2.6);});
test('3 OP / 2 bobinas: empalme de 60 m, no 100 m',()=>{const ops=Array.from({length:3},(_,i)=>({...base,id:'OP'+i,setupBooks:0,calibration:false,stops:0}));const r=calculate(ops,[roll(),roll()]);near(r.spliceMeters,60);near(r.sums.reduce((s,o)=>s+o.spliceMeters,0),60);});
test('2 OP / 3 bobinas: empalme de 60 m, no 100 m',()=>{const ops=Array.from({length:2},(_,i)=>({...base,id:'OP'+i,setupBooks:0,calibration:false,stops:0}));const r=calculate(ops,[roll(),roll(),roll()]);near(r.spliceMeters,60);near(r.sums[0].spliceMeters,20);near(r.sums[1].spliceMeters,40);});
test('Asignación por etapas y por ancho real: conserva metros y cada kg',()=>{
 const r=calculate([base],[roll(30,1000,2),roll(100,500,3)]);
 // Primera bobina: 272 m de set up y 8 m de calibración; los otros 18 m pasan a la segunda.
 near(r.loads[0].processKg,28);near(r.loads[0].productiveKg,0);near(r.loads[0].left,0);
 near(r.loads[1].productiveKg,36);near(r.loads[1].processKg,(18+40+54.4)*.05);
 near(r.sums[0].spliceMeters,40);near(r.saldo,55.38);
 for(const b of r.loads)near(b.initial,b.scrap+b.productiveKg+b.processKg+b.left);
 for(const d of r.details){near(d.metros,d.productionMeters+d.setupMeters+d.calibrationMeters+d.spliceMeters+d.stopMeters);near(d.kg,d.productiveKg+d.processKg);near(d.kg,d.metros*d.ancho*100/1e6);}
});
test('Setup, calibración y paradas diferentes por OP',()=>{const r=calculate([{...base,id:'A'},{...base,id:'B',setupBooks:3,calibration:false,stops:0}],[roll(400)]);near(r.sums[0].stopMeters,54.4);near(r.sums[1].setupMeters,81.6);near(r.sums[1].calibrationMeters,0);near(r.sums[1].stopMeters,0);});
test('Material justo, saldo cero e insuficiencia por descuentos de proceso',()=>{near(calculate([base],[roll(109.24)]).saldo,0);assert.throws(()=>calculate([base],[roll(109.23)]),/Material insuficiente/);});
test('Validación: no permite negativos, fracciones ni entradas inválidas',()=>{for(const key of ['setupBooks','stops'])for(const value of (key==='stops'?[-1,.5,NaN,Infinity]:[-1,.5,'',NaN,Infinity]))assert.throws(()=>calculate([{...base,[key]:value}]),/enteras/);assert.throws(()=>calculate([{...base,calibration:'false'}]),/calibración/);});
test('Lonjas y tuco se descuentan una vez además del proceso',()=>{const r=calculate([base],[roll(200,480,5,10)],'Bond',90);near(r.loads[0].corePaper,9.01);near(r.loads[0].scrap,14.01);near(r.total,1092.4*.0432);near(r.saldo,200-14.01-1092.4*.0432);});
test('Paquete Forms conserva nueve columnas iniciales y amplía el detalle',()=>{const r=calculate();const a=html.indexOf('function groupText('),b=html.indexOf('const originalFormsInstructions',a);const c={r,fmt:String};vm.createContext(c);const packet=vm.runInContext(html.slice(a,b)+';groupText(r)',c);const cols=packet.split('||')[1].split('~');assert.equal(cols[0],'OP1');assert.equal(cols[2],'30');assert.equal(cols.length,20);assert.equal(cols[9],'10');assert.equal(cols[10],'1');assert.equal(cols[11],'2');near(Number(cols[4]),1092.4);near(Number(cols[6]),90.76);assert.equal(cols[19],'2');});
test('Copias comunes modifican corrida y set up; no modifican los 26 m de calibración',()=>{const r=calculate([{...base,copies:40}]);near(r.sums[0].productionMeters,960);near(r.sums[0].setupMeters,296);near(r.sums[0].calibrationMeters,26);near(r.sums[0].stopMeters,59.2);near(r.sums[0].metros,1361.2);});
test('Paradas vacías equivalen a cero en cálculo y registro',()=>{const zero=calculate([{...base,stops:0}]);for(const stops of ['',undefined,null]){const r=calculate([{...base,stops}]);near(r.sums[0].stopMeters,0);near(r.total,zero.total);near(r.saldo,zero.saldo);assert.equal(r.sourceOps[0].stops,0);}});
test('Varias OP: paradas vacías en una OP no borran las de otra',()=>{const r=calculate([{...base,id:'A',stops:''},{...base,id:'B',stops:2}],[roll(400)]);near(r.sums[0].stopMeters,0);near(r.sums[1].stopMeters,54.4);assert.equal(r.sourceOps[0].stops,0);assert.equal(r.sourceOps[1].stops,2);});
test('Bond 75 y ancho 660: calibración marcada descuenta 26 m = 1,287 kg',()=>{
 const op={...base,books:500,copies:38,setupBooks:0,calibration:true,stops:0};
 const a=calculate([op],[roll(400,660)],'Bond',75),b=calculate([{...op,calibration:false}],[roll(400,660)],'Bond',75);
 near(a.sums[0].calibrationMeters,26);near(b.saldo-a.saldo,1.287);near(a.saldo,172.003);near(b.saldo,173.29);
 const multi=calculate([{...op,id:'A'},{...op,id:'B',calibration:false}],[roll(800,660)],'Bond',75);near(multi.sums[0].calibrationMeters,26);near(multi.sums[1].calibrationMeters,0);
});
test('Kirin 4C: 13 m de blanco en set up, calibración y paradas; empalme de 20 m',()=>{
 const a=calculate([base],[roll()],'Otro papel',100,'kirin-1c'),b=calculate([base],[roll()],'Otro papel',100,'kirin-4c');
 const s=b.sums[0];near(s.productionMeters,720);near(s.setupMeters,202);near(s.calibrationMeters,19);near(s.stopMeters,40.4);near(s.spliceMeters,20);
 near(s.metros,1001.4);near(b.saldo,99.86);near(a.saldo,90.76);assert.equal(b.processRules,3);
 const idle={...base,setupBooks:0,calibration:false,stops:0};
 near(calculate([idle,idle,idle].map((o,i)=>({...o,id:'OP'+i})),[roll(300),roll(300)],'Otro papel',100,'kirin-4c').spliceMeters,60);
});
test('Faltante del grupo: suma el resto de la primera OP y todas las OP siguientes',()=>{
 const ops=[{...base,id:'A'},{...base,id:'B'}];
 assert.throws(()=>calculate(ops,[roll(100)]),e=>{
  assert.match(e.message,/Material insuficiente desde la OP A/);
  near(e.shortage.meters,1184.8);near(e.shortage.kg,118.48);
  assert.equal(e.shortage.mixed,false);
  near(e.shortage.loads[0].left,0);
  return true;
 });
 assert.throws(()=>calculate(ops,[roll(25,1000),roll(25,500)]),e=>{
  assert.equal(e.shortage.mixed,true);assert.equal(e.shortage.width,500);
  near(e.shortage.meters,1434.8);near(e.shortage.kg,71.74);return true;
 });
});
console.log(count+' pruebas de proceso correctas.');
