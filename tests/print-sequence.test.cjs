const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const from=html.indexOf('function coreTareFor('),to=html.indexOf('function table(',from);
const engine=html.slice(from,to);
const table=html.slice(to,html.indexOf('function renderRollUsage(',to));
const start=html.indexOf('function buildPrintSummary('),report=html.slice(start,html.indexOf('function preparePrintSummary(',start));
const nf=html.match(/const nf=x=>[^;]+;/)[0];
const base={books:1,copies:1,advance:1000,setupBooks:0,calibration:false,stops:0};
function calculate(ops,rolls){const c={ops:ops.map((o,i)=>({...base,id:'OP'+(i+1),...o})),rolls:rolls.map((r,i)=>({id:'Bobina '+(i+1),width:1000,scrap:0,coreGross:0,coreTare:0,...r})),$:id=>({value:id==='multi-gsm'?'100':'Otro papel'}),numeric:Number};vm.createContext(c);vm.runInContext(nf+engine,c);return vm.runInContext('validate()',c);}
function print(r){const c={r,escapeHtml:s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))};vm.createContext(c);return vm.runInContext(nf+table+report+";buildPrintSummary(r,'Prueba')",c);}
function rows(output){return [...output.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c=>c[1]));}
const number=s=>Number(s.replace(/,/g,''));
let count=0;function test(name,fn){fn();count++;console.log('OK '+name);}
test('500 kg en cada bobina: la segunda queda en 380 y la OP siguiente arranca en 380',()=>{
 const r=calculate([{books:5880},{books:980}],[{kg:500,scrap:10},{kg:500,scrap:20}]);
 const before=JSON.stringify(r),out=print(r),data=rows(out);
 assert.equal(data.length,3);
 assert.deepEqual(data[0],['OP1','Bobina 1','500.0','488.0','12.0','0.0']);
 assert.deepEqual(data[1],['OP1','Bobina 2','500.0','100.0','20.0','380.0']);
 assert.deepEqual(data[2],['OP2','Bobina 2','380.0','98.0','2.0','280.0']);
 for(const row of data)assert.equal(number(row[2])-number(row[3])-number(row[4]),number(row[5]));
 assert.match(out,/TOTAL A ENTREGAR AL ALMACÉN <strong>280.0 kg/);
 assert.equal(JSON.stringify(r),before);
});
test('No repite parámetros ni anchos en las tablas',()=>{const out=print(calculate([{books:100}],[{kg:500}]));assert.doesNotMatch(out,/Parámetros por OP|Metraje y consumo|Libros|Copias|<th>Ancho/);assert.equal((out.match(/ANCHO/g)||[]).length,1);assert.equal((out.match(/1,000.0 mm/g)||[]).length,1);});
test('Lonjas y sobrante neto solo se descuentan al abrir la bobina',()=>{const r=calculate([{books:500},{books:500}],[{kg:500,scrap:10,coreGross:6,coreTare:1}]);const data=rows(print(r));assert.equal(data[0][4],'17.0');assert.equal(data[1][4],'2.0');assert.equal(data[1][2],data[0][5]);});
test('Bobina totalmente retirada antes de máquina conserva su movimiento y saldo cero',()=>{const r=calculate([{books:100}],[{kg:5,scrap:5},{kg:100}]);const data=rows(print(r));assert.deepEqual(data[0],['—','Bobina 1','5.0','0.0','5.0','0.0']);assert.equal(data[1][2],'100.0');assert.match(print(r),/Agotada/);});
test('Bobinas no utilizadas no se suman al PDF; anchos distintos aparecen solo arriba',()=>{const r=calculate([{books:1000}],[{kg:50,width:1000},{kg:100,width:500},{kg:100,width:700}]);const out=print(r),data=rows(out);assert.equal(data.length,2);assert.doesNotMatch(out,/Bobina 3/);assert.match(out,/Bobina 1: <strong>1,000.0 mm/);assert.match(out,/Bobina 2: <strong>500.0 mm/);});
test('Instantáneas anteriores sin separación de proceso siguen siendo imprimibles',()=>{const r={paper:'Bond',gsm:90,saldo:380,usedRolls:[{id:'Bobina 1',initial:500,width:480,retired:20,corePaper:0,left:380}],details:[{op:'ANTERIOR',bobina:'Bobina 1',kg:100,saldo:380}]};assert.deepEqual(rows(print(r))[0],['ANTERIOR','Bobina 1','500.0','100.0','20.0','380.0']);});
console.log(count+' pruebas de secuencia e impresión correctas.');
