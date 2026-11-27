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
 assert.equal(row[4],'001 / 002');assert.deepEqual(row.slice(5),[100,120,20,20,'Ahorro','job']);
 assert.equal(JSON.stringify(result),before);
 assert.match(R.comparisonHTML(result),/saving/);
 assert.match(R.comparisonHTML({...result,saldo:80}),/overuse/);
 assert.equal(R.comparisonHTML({...result,warehouseExpectedKg:null}),'');
});
