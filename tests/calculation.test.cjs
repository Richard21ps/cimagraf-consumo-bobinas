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
test('Una OP / una bobina: papel retirado una vez',()=>{const r=calculate([1000],[[200,1000,10]]);near(r.total,70);near(r.saldo,120);near(r.totalScrap,10);});
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
test('Tres bobinas: dos agotadas y una con saldo',()=>{const r=calculate([3000],[[75,1000,5],[45,500,10],[200,700,10]]);near(r.loads[0].left,0);near(r.loads[1].left,0);near(r.loads[2].left,141);near(r.saldo,141);near(r.total,154);});
const renderStart=html.indexOf('function renderRollUsage(r){');
const renderSource=html.slice(renderStart,html.indexOf('\nfunction show(){',renderStart));
const numberFormatSource=html.match(/const nf=x=>[^;]+;/)[0];
function render(r){const targets={};const rolls=r?r.loads:[{}];const context={$:id=>targets[id]??(targets[id]={innerHTML:''}),rolls,EPS:1e-8,MIN_RETURN_PER_BOBINA:100,escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'),r};vm.createContext(context);vm.runInContext(numberFormatSource+renderSource+';renderRollUsage(r)',context);return Object.values(targets).map(t=>t.innerHTML).join('');}

test('Gráfico: saldos reales de las tres bobinas',()=>{const output=render(calculate([3000],[[75,1000,5],[45,500,10],[200,700,10]]));assert.equal((output.match(/usage-empty/g)||[]).length,2);assert.match(output,/141[.]0 <small>kg/);assert.match(output,/papel retirado 10[.]0 kg/);assert.match(output,/Saldo/);assert.match(output,/Producción/);});
test('Gráfico: bobina sin utilizar y saldo inferior al mínimo',()=>{const output=render(calculate([1000],[[179,1000,10],[300,500]]));assert.match(output,/Saldo menor a 100 kg/);assert.match(output,/Disponible/);assert.match(output,/300[.]0 <small>kg/);assert.match(output,/No suma a la devolución/);});
test('Gráfico: datos pendientes no muestran saldos anteriores',()=>assert.match(render(null),/Por calcular/));
test('Sintaxis de ambos scripts',()=>{for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);});
assert.doesNotMatch(html,/id="multi-total-(meters|consumption|scrap)"/);
const problemStart=html.indexOf('const PROBLEM_CATALOG_KEY=');
const problemSource=html.slice(problemStart,html.indexOf('function redraw(){',problemStart));
function problemContext(saved){const context={localStorage:{getItem:()=>saved},escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')};vm.createContext(context);vm.runInContext(problemSource,context);return context;}
test('Catálogo de problemáticas vacío y datos guardados inválidos',()=>{for(const saved of [null,'{','{}'])assert.equal(vm.runInContext('problemCatalog.length',problemContext(saved)),0);});
test('Catálogo sin duplicados ni entradas inválidas',()=>{const c=problemContext(JSON.stringify([' Prueba   interna ','prueba interna',42,null,'']));assert.equal(vm.runInContext('problemCatalog.length',c),1);assert.equal(vm.runInContext('problemCatalog[0]',c),'Prueba interna');});
test('Seleccionar problemáticas no duplica ni modifica el peso',()=>{const c=problemContext('[]');c.roll={scrap:'12'};vm.runInContext("assignProblem(roll,' Prueba A ');assignProblem(roll,'prueba a');assignProblem(roll,'Prueba B')",c);assert.equal(c.roll.problems.length,2);assert.equal(c.roll.scrap,'12');});
test('Desplegable de problemáticas escapa nombres y comienza plegado',()=>{const c=problemContext('["<prueba>"]');c.roll={id:'Bobina 1'};const output=vm.runInContext('problemControls(roll,0)',c);assert.match(output,/&lt;prueba>/);assert.doesNotMatch(output,/<prueba>/);assert.doesNotMatch(output,/data-problems-roll="0" open/);});
test('Redondeo visual a un decimal conserva saldo real y control',()=>{const r=calculate([1000],[[180.04,1000,10.05]]);near(r.saldo,99.99);assert.equal(r.returnViolations.length,1);assert.match(render(r),/100[.]0 <small>kg/);assert.match(render(r),/REVISAR/);});
test('Resumen de bobinas bajo el total, fuera de las filas de entrada',()=>{assert.match(html,/id="multi-roll-usage"/);assert.doesNotMatch(html,/class="bobbin-visual"/);assert.ok(html.indexOf('id="multi-roll-usage"')>html.indexOf('id="multi-delivery"'));assert.ok(html.indexOf('id="multi-roll-usage"')<html.indexOf('id="multi-delivery-status"'));});

test('Motivo nuevo: formulario oculto hasta que se solicite',()=>{const c=problemContext('[]');c.roll={id:'Bobina 1'};const output=vm.runInContext('problemControls(roll,0)',c);assert.match(output,/¿Por qué se retiró papel/);assert.match(output,/class="problem-form" hidden/);assert.match(output,/data-problem-start/);assert.doesNotMatch(output,/Problemáticas del papel retirado/);});
test('Motivos elegidos visibles aunque el apartado esté cerrado',()=>{const c=problemContext('["Motivo A"]');c.roll={id:'Bobina 1',problems:['Motivo A']};const output=vm.runInContext('problemControls(roll,0)',c);assert.ok(output.indexOf('class="problem-tags"')>output.indexOf('</details>'));assert.match(output,/✓ Motivo A/);});
console.log(`${count} pruebas correctas y estructura del desglose verificada.`);
