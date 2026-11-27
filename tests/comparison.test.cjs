const test=require('node:test'),assert=require('node:assert/strict');
const {CimagrafRecord:R}=require('../record-data.js');
test('Ahorro y mayor consumo se calculan sobre la devolución prevista del grupo',()=>{
 assert.deepEqual(R.comparison({warehouseExpectedKg:100,saldo:120}),{expected:100,actual:120,kg:20,percent:20,status:'Ahorro'});
 assert.deepEqual(R.comparison({warehouseExpectedKg:100,saldo:80}),{expected:100,actual:80,kg:-20,percent:-20,status:'Mayor consumo'});
 assert.equal(R.comparison({warehouseExpectedKg:100,saldo:100}).status,'Sin diferencia');
 assert.equal(R.comparison({warehouseExpectedKg:100,saldo:100+1e-10}).kg,0);
});
test('Dato ausente, inválido y referencia cero no generan porcentajes falsos',()=>{
 for(const expected of [undefined,null,'',-1,'texto',Infinity])assert.equal(R.comparison({warehouseExpectedKg:expected,saldo:120}),null);
 assert.equal(R.comparison({warehouseExpectedKg:0,saldo:20}).percent,null);
 assert.equal(R.comparison({warehouseExpectedKg:0,saldo:20}).kg,20);
 assert.match(R.comparisonHTML({warehouseExpectedKg:0,saldo:20}),/no se calcula un porcentaje sobre cero/);
});
test('Una fila de comparación representa todo el grupo con varias OP y bobinas',()=>{
 const result={warehouseExpectedKg:100,saldo:120,machine:'Kirin 4C',recordId:'KIRIN 4C - 01',sourceOps:[{id:'001'},{id:'002'}]};
 const before=JSON.stringify(result),row=R.comparisonRow(result,'2026-11-27T14:00:00Z','job');
 assert.equal(row.length,R.comparisonHeaders.length);
 assert.equal(row[4],'001 / 002');assert.deepEqual(row.slice(5),[100,120,20,20,'Ahorro','job','','','Devolución prevista']);
 assert.equal(JSON.stringify(result),before);
 assert.match(R.comparisonHTML(result),/saving/);
 assert.match(R.comparisonHTML({...result,saldo:80}),/overuse/);
 assert.equal(R.comparisonHTML({...result,warehouseExpectedKg:null}),'');
});

test('La base nueva es despacho menos devolución y el ahorro es respecto a lo asignado',()=>{
 const r={comparisonBasis:'assigned',warehouseExpectedKg:100,saldo:120,loads:[{initial:200},{initial:300}]};
 assert.deepEqual(R.comparison(r),{expected:100,actual:120,dispatched:500,assigned:400,kg:20,percent:5,status:'Ahorro'});
 assert.equal(R.comparison({...r,saldo:80}).percent,-5);
 assert.equal(R.comparison({...r,saldo:100}).percent,0);
 assert.match(R.comparisonHTML(r),/Asignado: <strong>400.0 kg/);
 assert.match(R.comparisonHTML(r),/Ahorro: 20.0 kg · 5.0 %/);
 assert.doesNotMatch(R.comparisonHTML(r,false),/Despacho: /);
});
test('Con devolución cero usa todo el despacho; asignado cero no divide ni inventa porcentaje',()=>{
 const r={comparisonBasis:'assigned',loads:[{initial:500}],saldo:120};
 assert.equal(R.comparison({...r,warehouseExpectedKg:0}).percent,24);
 const c=R.comparison({...r,warehouseExpectedKg:500});assert.equal(c.assigned,0);assert.equal(c.percent,null);
 assert.match(R.comparisonHTML({...r,warehouseExpectedKg:500}),/kg asignados son 0/);
 assert.equal(R.comparison({...r,warehouseExpectedKg:501}),null);
 assert.equal(R.comparison({...r,warehouseExpectedKg:100,loads:[]}),null);
});
test('El Excel registra despacho, asignado y la nueva base sin repetir el ahorro por bobina',()=>{
 const r={comparisonBasis:'assigned',warehouseExpectedKg:100,saldo:120,loads:[{initial:500}],machine:'Kirin 1C',recordId:'KIRIN 1C - 01',sourceOps:[{id:'001'},{id:'002'}]};
 const row=R.comparisonRow(r,'2026-11-27T14:00:00Z','job');
 assert.equal(row.length,14);assert.deepEqual(row.slice(5),[100,120,20,5,'Ahorro','job',500,400,'Kg asignados']);
});

test('El registro local agrega solo ahorro en kg y porcentaje, una vez por grupo',()=>{
 const {calculate}=require('./excel-fixture.cjs');
 const r=calculate([{id:'A',books:100,copies:30,advance:240},{id:'B',books:100,copies:30,advance:240}]);
 Object.assign(r,{comparisonBasis:'assigned',savingsInRegister:true,warehouseExpectedKg:50});
 const c=R.comparison(r),rows=R.localRows(r,'2026-11-27T14:00:00Z','job');
 assert.deepEqual(R.localHeaders.slice(26),['Ahorro (kg)','Ahorro (%)']);
 assert.equal(rows.length,2);assert.equal(rows[0].length,28);
 assert.deepEqual(rows[0].slice(26),[c.kg,c.percent]);assert.deepEqual(rows[1].slice(26),['','']);
 assert.equal(rows.reduce((sum,row)=>sum+Number(row[26]),0),c.kg);
 const previous=R.localRows({...r,savingsInRegister:false},'2026-11-27T14:00:00Z','old');
 assert.deepEqual(previous[0].slice(26),['','']);
});
test('Sin referencia no inventa ahorro; un mayor consumo queda negativo en Excel',()=>{
 const {calculate}=require('./excel-fixture.cjs'),r=calculate();
 Object.assign(r,{comparisonBasis:'assigned',savingsInRegister:true});
 assert.deepEqual(R.localRows(r,'2026-11-27T14:00:00Z','j')[0].slice(26),['','']);
 r.warehouseExpectedKg=190;const row=R.localRows(r,'2026-11-27T14:00:00Z','j')[0];assert(row[26]<0);assert(row[27]<0);
});
