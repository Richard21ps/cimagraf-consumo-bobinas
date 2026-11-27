const test=require('node:test'),assert=require('node:assert/strict');
const {calculate,record}=require('./excel-fixture.cjs');
const op=id=>({id,books:100,copies:30,advance:240,setupBooks:0,calibration:false,stops:0});
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('Cada bobina atribuye lonjas a su primera OP y sobrante a su última OP',()=>{
 const r=calculate([op('A'),op('B'),op('C')],[{kg:500,scrap:10,coreGross:6}]);
 const before=JSON.stringify(r),moves=record.movements(r);
 assert.equal(moves.length,3);near(moves[0].retired,10);near(moves[0].core,0);
 near(moves[1].retired,0);near(moves[1].core,0);near(moves[2].retired,0);near(moves[2].core,5.01);
 for(const m of moves)near(m.opening-m.production-m.deductions,m.balance);
 near(moves[1].opening,moves[0].balance);near(moves[2].opening,moves[1].balance);
 near(moves.at(-1).balance,r.saldo);near(r.sums[0].retiredKg,10);near(r.sums[2].corePaperKg,5.01);
 near(r.sums.reduce((sum,o)=>sum+o.totalConsumedKg,0),r.total+r.totalScrap);
 assert.equal(JSON.stringify(r),before);
});
test('Una sola OP recibe ambos descuentos una sola vez y el Excel coincide',()=>{
 const r=calculate([op('A')],[{kg:500,scrap:10,coreGross:6}]);
 const m=record.movements(r)[0],row=record.rows(r,'2026-11-27T14:00:00Z','j')[0];
 near(m.retired,10);near(m.core,5.01);near(row[17],10);near(row[18],5.01);near(row[13],m.deductions);
});
test('Solo la primera bobina puede identificarse como saldo de planta',()=>{
 const r=calculate([op('A')],[{kg:100,isPlantBalance:true},{kg:500,isPlantBalance:true}]);
 assert.equal(r.loads[0].isPlantBalance,true);assert.equal(r.loads[1].isPlantBalance,false);
});
test('Registros anteriores mantienen sus descuentos al inicio al reintentar',()=>{
 const old={usedRolls:[{id:'Bobina 1',initial:100,retired:10,corePaper:5,left:45}],details:[{op:'A',bobina:'Bobina 1',productiveKg:20,processKg:0,saldo:65},{op:'B',bobina:'Bobina 1',productiveKg:20,processKg:0,saldo:45}],sourceOps:[{id:'A'},{id:'B'}]};
 const moves=record.movements(old);near(moves[0].core,5);near(moves[1].core,0);
});

test('Saldo de planta fuera de asignación, pero dentro del consumo; bobina intacta no falsea el ahorro',()=>{
 const r={comparisonMethod:'consumption',comparisonBasis:'assigned',warehouseExpectedKg:500,total:870,totalScrap:30,saldo:200,loads:[{initial:100,isPlantBalance:true},{initial:500},{initial:500},{initial:500}]};
 const c=record.comparison(r);near(c.dispatched,1500);near(c.plantBalance,100);near(c.assigned,1000);near(c.consumed,900);near(c.kg,100);near(c.percent,10);
 const changed=record.comparison({...r,saldo:700});near(changed.kg,100);near(changed.percent,10);
 const unmarked=structuredClone(r);unmarked.loads[0].isPlantBalance=false;near(record.comparison(unmarked).assigned,1100);
});
test('Un exceso queda negativo en Excel y cero no inventa ahorro',()=>{
 const r=calculate([op('A'),op('B')],[{kg:100,isPlantBalance:true},{kg:500}]);
 Object.assign(r,{comparisonMethod:'consumption',comparisonBasis:'assigned',warehouseExpectedKg:490,savingsInRegister:true});
 const c=record.comparison(r);assert(c.kg<0);assert(c.percent<0);assert.equal(c.status,'Exceso de consumo');
 const rows=record.localRows(r,'2026-11-27T14:00:00Z','j');near(rows[0][26],c.kg);assert(rows.slice(1).every(row=>row[26]===''));
 r.warehouseExpectedKg=500-(r.total+r.totalScrap);near(record.comparison(r).kg,0);assert.equal(record.comparison(r).status,'Sin ahorro');
});
