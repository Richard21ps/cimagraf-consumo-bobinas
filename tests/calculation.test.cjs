const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
// Ejecuta la función de producción, sin mantener una copia del motor.
const start = html.indexOf('function validate(){', html.indexOf('const MIN_RETURN_PER_BOBINA'));
const source = html.slice(start, html.indexOf('\nfunction table(', start));
function calculate(meters, bobbins) {
  const context = {ops: meters.map((m,i)=>({id:'OP'+i,books:m,copies:1,advance:1000})),
    rolls: bobbins.map(([kg,width,scrap=0],i)=>({id:'Bobina '+(i+1),kg,width,scrap})),
    $: id=>({value:id==='multi-gsm'?'70':'Book Cream'}), numeric:Number,
    MIN_RETURN_PER_BOBINA:100,nf:String};
  vm.createContext(context);
  return vm.runInContext(source+';validate()',context);
}
function near(actual, expected) {assert.ok(Math.abs(actual-expected)<1e-7, `${actual} != ${expected}`);}
let count=0;
function test(name, run) {run(); count++; console.log('OK '+name);}
test('Una OP / una bobina: merma una vez',()=>{const r=calculate([1000],[[200,1000,10]]);near(r.total,70);near(r.saldo,120);near(r.totalScrap,10);});
test('Varias OP / una bobina',()=>{const r=calculate([400,600],[[200,1000,10]]);near(r.sums[0].kg,28);near(r.sums[1].kg,42);near(r.saldo,120);});
test('Una OP / varias bobinas con anchos distintos',()=>{const r=calculate([2000],[[75,1000,5],[200,500,10]]);near(r.total,105);near(r.loads[0].left,0);near(r.loads[1].left,155);near(r.totalScrap,15);});
test('Varias OP / varias bobinas con anchos distintos',()=>{const r=calculate([600,1400],[[75,1000,5],[200,500,10]]);near(r.sums[0].kg,42);near(r.sums[1].kg,63);near(r.saldo,155);assert.equal(r.details.length,3);});
test('Saldo cero permitido',()=>{const r=calculate([1000],[[80,1000,10]]);near(r.saldo,0);assert.equal(r.returnViolations.length,0);});
test('Saldo 100 permitido',()=>{const r=calculate([1000],[[180,1000,10]]);near(r.saldo,100);assert.equal(r.returnViolations.length,0);});
test('Saldo inferior a 100 se conserva y bloquea',()=>{const r=calculate([1000],[[179,1000,10]]);near(r.saldo,99);assert.equal(r.returnViolations.length,1);});
test('Material insuficiente',()=>assert.throws(()=>calculate([1001],[[80,1000,10]]),/Material insuficiente/));
test('Merma superior al peso',()=>assert.throws(()=>calculate([1000],[[80,1000,81]]),/no puede superar/));
test('Merma negativa',()=>assert.throws(()=>calculate([1000],[[200,1000,-1]]),/mayor o igual/));
test('Bobina no utilizada no suma devolución',()=>{const r=calculate([1000],[[200,1000,10],[300,500]]);near(r.saldo,120);assert.equal(r.usedRolls.length,1);});
test('Balance de masa y metraje por movimiento',()=>{const r=calculate([600,1400],[[75,1000,5],[200,500,10]]);for(const b of r.usedRolls)near(b.initial,b.scrap+b.used+b.left);near(r.details.reduce((s,d)=>s+d.metros,0),2000);});
assert.match(html, /<details id="multi-calculation-details" class="multi-calculation-details">/);
assert.ok(html.indexOf('id="multi-register"')>html.indexOf('</details>',html.indexOf('id="multi-calculation-details"')));
console.log(`${count} pruebas del motor y 2 comprobaciones de estructura correctas.`);
