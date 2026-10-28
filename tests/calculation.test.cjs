const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
// Ejecuta la función de producción, sin mantener una copia del motor.
const start = html.indexOf('function validate(){', html.indexOf('const GROUP_FORM_KEYS'));
const source = html.slice(start, html.indexOf('\nfunction table(', start));
const removalSource=html.slice(html.indexOf('function coreTareFor('),start);
function calculate(meters, bobbins, paper='Otro papel', gsm=70) {
  const context = {ops: meters.map((m,i)=>({id:'OP'+i,books:m,copies:1,advance:1000})),
    rolls: bobbins.map(([kg,width,scrap=0,coreGross=0,coreTare=''],i)=>({id:'Bobina '+(i+1),kg,width,scrap,coreGross,coreTare})),
    $: id=>({value:id==='multi-gsm'?String(gsm):paper}), numeric:Number,
    nf:String};
  vm.createContext(context);
  return vm.runInContext(removalSource+source+';validate()',context);
}
function near(actual, expected) {assert.ok(Math.abs(actual-expected)<1e-7, `${actual} != ${expected}`);}
let count=0;
function test(name, run) {run(); count++; console.log('OK '+name);}
test('Una OP / una bobina: papel retirado una vez',()=>{const r=calculate([1000],[[200,1000,10]]);near(r.total,70);near(r.saldo,120);near(r.totalScrap,10);});
test('Varias OP / una bobina',()=>{const r=calculate([400,600],[[200,1000,10]]);near(r.sums[0].kg,28);near(r.sums[1].kg,42);near(r.saldo,120);});
test('Una OP / varias bobinas con anchos distintos',()=>{const r=calculate([2000],[[75,1000,5],[200,500,10]]);near(r.total,105);near(r.loads[0].left,0);near(r.loads[1].left,155);near(r.totalScrap,15);});
test('Varias OP / varias bobinas con anchos distintos',()=>{const r=calculate([600,1400],[[75,1000,5],[200,500,10]]);near(r.sums[0].kg,42);near(r.sums[1].kg,63);near(r.saldo,155);assert.equal(r.details.length,3);});
test('Saldo cero permitido',()=>{const r=calculate([1000],[[80,1000,10]]);near(r.saldo,0);assert.ok(r.saldo>=0);});
test('Saldo 100 permitido',()=>{const r=calculate([1000],[[180,1000,10]]);near(r.saldo,100);assert.ok(r.saldo>=0);});
test('Saldo inferior a 100 se conserva y permite',()=>{const r=calculate([1000],[[179,1000,10]]);near(r.saldo,99);assert.ok(!Object.hasOwn(r,'returnViolations'));});
test('Material insuficiente',()=>assert.throws(()=>calculate([1001],[[80,1000,10]]),/Material insuficiente/));
test('Merma superior al peso',()=>assert.throws(()=>calculate([1000],[[80,1000,81]]),/no pued.*superar/));
test('Merma negativa',()=>assert.throws(()=>calculate([1000],[[200,1000,-1]]),/mayor o igual/));
test('Bobina no utilizada no suma devolución',()=>{const r=calculate([1000],[[200,1000,10],[300,500]]);near(r.saldo,120);assert.equal(r.usedRolls.length,1);});
test('Balance de masa y metraje por movimiento',()=>{const r=calculate([600,1400],[[75,1000,5],[200,500,10]]);for(const b of r.usedRolls)near(b.initial,b.scrap+b.used+b.left);near(r.details.reduce((s,d)=>s+d.metros,0),2000);});
assert.match(html, /<details id="multi-calculation-details" class="multi-calculation-details">/);
assert.ok(html.indexOf('id="multi-register"')>html.indexOf('</details>',html.indexOf('id="multi-calculation-details"')));
test('Tres bobinas: dos agotadas y una con saldo',()=>{const r=calculate([3000],[[75,1000,5],[45,500,10],[200,700,10]]);near(r.loads[0].left,0);near(r.loads[1].left,0);near(r.loads[2].left,141);near(r.saldo,141);near(r.total,154);});
const renderStart=html.indexOf('function renderRollUsage(r){');
const renderSource=html.slice(renderStart,html.indexOf('\nfunction show(){',renderStart));
const numberFormatSource=html.match(/const nf=x=>[^;]+;/)[0];
function render(r){const targets={};const rolls=r?r.loads:[{}];const context={$:id=>id==='multi-paper'?{value:'Otro papel'}:targets[id]??(targets[id]={innerHTML:''}),rolls,EPS:1e-8,numeric:x=>x===''?NaN:Number(x),escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'),r};vm.createContext(context);vm.runInContext(numberFormatSource+removalSource+renderSource+';renderRollUsage(r)',context);return Object.values(targets).map(t=>t.innerHTML).join('');}

test('Gráfico: saldos reales de las tres bobinas',()=>{const output=render(calculate([3000],[[75,1000,5],[45,500,10],[200,700,10]]));assert.equal((output.match(/usage-empty/g)||[]).length,2);assert.match(output,/141[.]0 <small>kg/);assert.match(output,/papel retirado y sobrante neto 10[.]0 kg/);assert.match(output,/Saldo/);assert.match(output,/Producción/);});
test('Gráfico: bobina sin utilizar y saldo pequeño sin bloqueo',()=>{const output=render(calculate([1000],[[179,1000,10],[300,500]]));assert.doesNotMatch(output,/Envío bloqueado|REVISAR/);assert.match(output,/Disponible/);assert.match(output,/300[.]0 <small>kg/);assert.match(output,/No suma a la devolución/);});
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
test('Redondeo visual a un decimal conserva saldo real sin mínimo',()=>{const r=calculate([1000],[[180.04,1000,10.05]]);near(r.saldo,99.99);assert.ok(!Object.hasOwn(r,'returnViolations'));assert.match(render(r),/100[.]0 <small>kg/);assert.match(render(r),/CON SALDO/);});
test('Resumen de bobinas bajo el total, fuera de las filas de entrada',()=>{assert.match(html,/id="multi-roll-usage"/);assert.doesNotMatch(html,/class="bobbin-visual"/);assert.ok(html.indexOf('id="multi-roll-usage"')>html.indexOf('id="multi-delivery"'));assert.ok(html.indexOf('id="multi-roll-usage"')<html.indexOf('id="multi-delivery-status"'));});

test('Motivo nuevo: formulario oculto hasta que se solicite',()=>{const c=problemContext('[]');c.roll={id:'Bobina 1'};const output=vm.runInContext('problemControls(roll,0)',c);assert.match(output,/¿Por qué se retiró papel/);assert.match(output,/class="reason-form problem-form" hidden/);assert.match(output,/data-problem-start/);assert.doesNotMatch(output,/Problemáticas del papel retirado/);});
test('Motivos elegidos visibles aunque el apartado esté cerrado',()=>{const c=problemContext('["Motivo A"]');c.roll={id:'Bobina 1',problems:['Motivo A']};const output=vm.runInContext('problemControls(roll,0)',c);assert.ok(output.indexOf('class="problem-tags"')>output.indexOf('</details>'));assert.match(output,/✓ Motivo A/);});
const printStart=html.indexOf('function buildPrintSummary(r,stamp){');
const printSource=html.slice(printStart,html.indexOf('function preparePrintSummary(){',printStart));
const tableStart=html.indexOf('function table(headers,rows){',html.indexOf('const GROUP_FORM_KEYS'));
const tableSource=html.slice(tableStart,html.indexOf('function renderRollUsage(r){',tableStart));
function printReport(r){const c={r,escapeHtml:s=>String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};vm.createContext(c);return vm.runInContext(numberFormatSource+tableSource+printSource+";buildPrintSummary(r,'Fecha de prueba')",c);}
test('Impresión: varias OP comparten bobina sin duplicar saldo final',()=>{const r=calculate([400,600],[[200,1000,10]]);const output=printReport(r);assert.match(output,/28[.]0/);assert.match(output,/42[.]0/);assert.match(output,/162[.]0/);assert.match(output,/TOTAL A ENTREGAR AL ALMACÉN <strong>120[.]0 kg/);});
test('Impresión: OP que usa varias bobinas incluye agotadas y saldo final',()=>{const output=printReport(calculate([2000],[[75,1000,5],[200,500,10]]));assert.match(output,/Bobina 1/);assert.match(output,/Bobina 2/);assert.match(output,/TOTAL A ENTREGAR AL ALMACÉN <strong>155[.]0 kg/);});
test('Impresión: no incluye bobinas sin utilizar y escapa identificadores',()=>{const r=calculate([1000],[[200,1000,10],[300,500]]);r.group='<img src=x>';r.details[0].op='<script>';const output=printReport(r);assert.doesNotMatch(output,/Bobina 2/);assert.doesNotMatch(output,/<img src=x>|<script>/);assert.match(output,/&lt;script&gt;/);});
test('Impresión disponible fuera del desglose, sin enviar a Forms',()=>{assert.ok(html.indexOf('id="multi-print"')>html.indexOf('</details>',html.indexOf('id="multi-calculation-details"')));const listener=html.slice(html.indexOf("$('multi-print').addEventListener"),html.indexOf("window.addEventListener('beforeprint'"));assert.match(listener,/window[.]print/);assert.doesNotMatch(listener,/forms|fetch|submit/);});
test('Envío habilitado con saldos cero, inferiores a 100 y mayores',()=>{
 const refreshStart=html.indexOf('function refreshOpQueue(){');
 const refresh=html.slice(refreshStart,html.indexOf('function groupText(',refreshStart));
 for(const kg of [80,80.01,179,180,200]){const r=calculate([1000],[[kg,1000,10]]);r.group='PRUEBA';const elements={};const c={result:r,escapeHtml:String,WITHDRAWAL_FORM_KEYS:{reasons:"",areas:""},$:id=>elements[id]??(elements[id]={})};vm.createContext(c);vm.runInContext(numberFormatSource+tableSource+refresh+';refreshOpQueue()',c);assert.equal(elements['multi-register'].disabled,false);}
});
test('Sin mensajes ni controles de devolución mínima en cálculo, gráfica o impresión',()=>{assert.doesNotMatch(html,/MIN_RETURN_PER_BOBINA|returnViolations|100 kg|Envío bloqueado: cada bobina/);const output=printReport(calculate([1000],[[179,1000,10]]));assert.match(output,/TOTAL A ENTREGAR AL ALMACÉN <strong>99[.]0 kg/);assert.doesNotMatch(output,/print-review/);});
test('Logo PNG integrado e idéntico en calculadora e impresión',()=>{const logo=html.match(/class="brand-logo" src="(data:image\/png;base64,[^"]+)"/)[1];const printed=printReport(calculate([1000],[[179,1000,10]]));assert.ok(printed.includes('class="print-logo" src="'+logo+'"'));assert.equal(Buffer.from(logo.split(',')[1],'base64').subarray(1,4).toString(),'PNG');});

test('Sobrante con tuco: resta solo papel y suma retiro una vez',()=>{const r=calculate([1000],[[200,1000,10,25,5]]);near(r.loads[0].corePaper,20);near(r.totalScrap,30);near(r.saldo,100);near(r.loads[0].initial,r.loads[0].used+r.loads[0].scrap+r.loads[0].left);assert.match(render(r),/Papel separado/);assert.match(render(r),/30[.]0 <small>kg/);});
test('Sobrante sin tara: saldo pendiente, nunca se inventa el cartón',()=>{assert.throws(()=>calculate([1000],[[200,1000,10,25,'']]),/Saldo pendiente/);const targets={};const c={rolls:[{id:'Bobina 1',scrap:10,coreGross:25,coreTare:''}],r:null,$:id=>id==='multi-paper'?{value:'Otro papel'}:targets[id]??(targets[id]={innerHTML:''}),numeric:x=>x===''?NaN:Number(x),escapeHtml:String,EPS:1e-8};vm.createContext(c);vm.runInContext(numberFormatSource+removalSource+renderSource+';renderRollUsage(r)',c);const output=targets['multi-roll-usage'].innerHTML;assert.match(output,/FALTA TARA/);assert.match(output,/35[.]0 <small>kg/);assert.match(output,/incluye cartón/);assert.match(output,/Saldo <b>— kg/);});
test('Tara no puede superar sobrante y suma no supera peso disponible',()=>{assert.throws(()=>calculate([1000],[[200,1000,10,25,26]]),/tuco vacío/);assert.throws(()=>calculate([1000],[[100,1000,50,80,5]]),/no pueden superar/);});
test('Sobrantes y anchos distintos conservan metraje y masa',()=>{const r=calculate([600,1400],[[80,1000,5,10,5],[200,500,10,20,5]]);near(r.loads[0].left,0);near(r.loads[1].left,140);near(r.total,105);near(r.totalScrap,35);for(const b of r.usedRolls)near(b.initial,b.used+b.scrap+b.left);});
test('Impresión destaca ancho junto a material y gramaje',()=>{const r=calculate([2000],[[75,1000,5],[200,500,10]]);const output=printReport(r);assert.match(output,/print-material-strip/);assert.match(output,/ANCHO/);assert.match(output,/Varios anchos/);assert.match(output,/1,000[.]0 mm/);assert.match(output,/500[.]0 mm/);assert.match(output,/Ancho \(mm\)/);});
const materialStart=html.indexOf('function sortMaterialEntries(');
const materialSource=html.slice(materialStart,html.indexOf('function updateCatalog(){',materialStart));
test('Materiales: Bond, Book Cream y gramajes de menor a mayor',()=>{const c={entries:[{name:'Book Cream',gsm:90},{name:'Bond',gsm:120},{name:'Bond',gsm:60},{name:'Book Cream',gsm:70},{name:'Couche',gsm:150}]};vm.createContext(c);const ordered=vm.runInContext(materialSource+';sortMaterialEntries(entries)',c);assert.equal(ordered.map(e=>e.name+':'+e.gsm).join('|'),'Bond:60|Bond:120|Book Cream:70|Book Cream:90|Couche:150');});

test('Tara Bond: referencia 480 mm y proporción por ancho',()=>{for(const [width,tare] of [[480,.990],[240,.495],[960,1.980]]){const r=calculate([100],[[200,width,10,25]],'Bond');near(r.loads[0].coreTare,tare);near(r.loads[0].corePaper,25-tare);near(r.saldo,200-10-25+tare-100*width*70/1e6);}});
test('Tara Book Cream: todos los gramajes y tipos por ancho',()=>{for(const paper of ['Book Cream','Book Cream 70','Book Cream Premium'])for(const gsm of [60,70,90,120])for(const [width,tare] of [[640,1.702],[320,.851],[480,1.2765]]){const r=calculate([100],[[200,width,10,25]],paper,gsm);near(r.loads[0].coreTare,tare);near(r.totalScrap,35-tare);}});
test('Sin sobrante no descuenta tara; tara automática prevalece sobre dato viejo',()=>{near(calculate([100],[[200,480,0,0]],'Bond').loads[0].coreTare,0);near(calculate([100],[[200,480,0,10,99]],'Bond').loads[0].coreTare,.990);});
test('Sobrante menor que tara se rechaza; tuco vacío deja cero papel',()=>{assert.throws(()=>calculate([100],[[200,480,0,.5]],'Bond'),/debe ser igual o mayor/);near(calculate([100],[[200,480,0,.990]],'Bond').loads[0].corePaper,0);});
test('Tara y retiros con varias OP y anchos conservan masa',()=>{const r=calculate([600,1400],[[80,1000,5,10],[200,500,10,20]],'Book Cream');for(const b of r.loads)near(b.initial,b.used+b.retired+b.corePaper+b.left);near(r.details.reduce((s,d)=>s+d.metros,0),2000);assert.match(printReport(r),/TOTAL A ENTREGAR/);});
test('Motivos explican alcance exclusivo del papel retirado',()=>{const c=problemContext('[]');c.roll={id:'Bobina 1'};assert.match(vm.runInContext('problemControls(roll,0)',c),/solo al papel retirado, no al sobrante de tuco/);});

const noteStart=html.indexOf('function coreTareControls(');
const noteSource=html.slice(noteStart,html.indexOf('function redraw(){',noteStart));
test('Nota de sobrante: tara y neto cambian al editar ancho y material',()=>{const note={innerHTML:'',hidden:false};const roll={width:480,coreGross:25};let paper='Bond';const c={rolls:[roll],root:{querySelector:()=>note},$:()=>({value:paper}),numeric:Number};vm.createContext(c);vm.runInContext(numberFormatSource+removalSource+noteSource+';refreshCoreTareNotes()',c);assert.match(note.innerHTML,/0[.]990/);assert.match(note.innerHTML,/24[.]0 kg de papel/);paper='Book Cream';roll.width=640;vm.runInContext('refreshCoreTareNotes()',c);assert.match(note.innerHTML,/1[.]702/);assert.match(note.innerHTML,/23[.]3 kg de papel/);roll.coreGross=0;vm.runInContext('refreshCoreTareNotes()',c);assert.equal(note.hidden,true);});

test('Áreas: Almacén y Planta digital disponibles con catálogo vacío o inválido',()=>{for(const saved of [null,'{','{}']){const c=problemContext(saved);assert.equal(vm.runInContext('areaCatalog.join("|")',c),'Almacén|Planta digital');}});
test('Áreas: selección múltiple sin duplicados y sin cambiar pesos',()=>{const c=problemContext('[]');c.roll={scrap:'12',coreGross:'8'};vm.runInContext("assignArea(roll,'Almacén');assignArea(roll,'almacén');assignArea(roll,' Planta digital ')",c);assert.equal(c.roll.areas.length,2);assert.equal(c.roll.scrap,'12');assert.equal(c.roll.coreGross,'8');});
test('Áreas guardadas: limpia nombres y conserva opciones predeterminadas',()=>{const c=problemContext('["Mantenimiento","mantenimiento",null,42]');assert.equal(vm.runInContext('areaCatalog.join("|")',c),'Almacén|Planta digital|Mantenimiento');});
test('Áreas: controles dentro del motivo y etiquetas fuera, con HTML escapado',()=>{const c=problemContext('[]');c.roll={id:'Bobina 2',areas:['<Área>']};const output=vm.runInContext('problemControls(roll,1)',c);assert.match(output,/data-area-select="1"/);assert.match(output,/data-area-start="1"/);assert.match(output,/Área: &lt;Área>/);assert.doesNotMatch(output,/<Área>/);assert.ok(output.indexOf('area-tags')>output.indexOf('</details>'));});
const withdrawalStart=html.indexOf('function withdrawalFormAnswers(');
const withdrawalSource=html.slice(withdrawalStart,html.indexOf('function groupText(',withdrawalStart));
test('Forms: respuestas distinguen bobinas y no incluyen sobrante sin papel retirado',()=>{const c={r:{loads:[{id:'Bobina 1',retired:12,problems:['Lonjas dañadas'],areas:['Almacén']},{id:'Bobina 2',retired:0,corePaper:10,problems:['No enviar'],areas:['No enviar']},{id:'Bobina 3',retired:2,problems:['Ajuste'],areas:['Planta digital','Mantenimiento']}]},fmt:String,WITHDRAWAL_FORM_KEYS:{reasons:'',areas:''}};vm.createContext(c);const answers=vm.runInContext(withdrawalSource+';withdrawalFormAnswers(r)',c);assert.match(answers.reasons,/Bobina 1 \(12 kg\): Lonjas dañadas/);assert.match(answers.areas,/Planta digital; Mantenimiento/);assert.doesNotMatch(answers.reasons+answers.areas,/Bobina 2|No enviar/);assert.equal(vm.runInContext('withdrawalFieldsConnected()',c),false);});
test('Impresión: motivo y área del papel retirado por bobina, sin alterar saldo',()=>{const r=calculate([1000],[[200,1000,10]]);r.usedRolls[0].problems=['<Daño>'];r.usedRolls[0].areas=['Almacén'];const output=printReport(r);assert.match(output,/Motivos del papel retirado/);assert.match(output,/Áreas involucradas/);assert.match(output,/&lt;Daño&gt;/);assert.match(output,/Almacén/);near(r.saldo,120);});

test('Motivos y áreas ocultos con cero o vacío desde el primer dibujo',()=>{const c=problemContext('[]');for(const scrap of ['0','',0]){c.roll={id:'Bobina 1',scrap,areas:['Almacén'],problems:['Daño']};assert.match(vm.runInContext('problemControls(roll,0)',c),/class="roll-problems-wrap" hidden/);}c.roll.scrap='0.1';assert.doesNotMatch(vm.runInContext('problemControls(roll,0)',c),/class="roll-problems-wrap" hidden/);});
test('Papel retirado positivo abre; cero y vacío ocultan solo esa bobina',()=>{const wrappers=[{hidden:true},{hidden:true}],panels=wrappers.map(w=>({open:false,closest:()=>w}));const c={localStorage:{getItem:()=>null},rolls:[{scrap:'0',problems:['Daño'],areas:['Almacén']},{scrap:'12'}],root:{querySelector:selector=>panels[Number(selector.match(/"(\d+)"/)[1])]}};vm.createContext(c);vm.runInContext(problemSource,c);vm.runInContext('syncWithdrawalControls(1)',c);assert.equal(wrappers[1].hidden,false);assert.equal(panels[1].open,true);for(const scrap of ['0','']){c.rolls[1].scrap=scrap;vm.runInContext('syncWithdrawalControls(1)',c);assert.equal(wrappers[1].hidden,true);assert.equal(panels[1].open,false);}assert.equal(wrappers[0].hidden,true);c.rolls[1].scrap='2';vm.runInContext('syncWithdrawalControls(1)',c);assert.equal(wrappers[1].hidden,false);assert.equal(c.rolls[0].problems[0],'Daño');assert.equal(c.rolls[0].areas[0],'Almacén');});

console.log(`${count} pruebas correctas y estructura del desglose verificada.`);
