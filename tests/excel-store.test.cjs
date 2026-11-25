const test=require('node:test'),assert=require('node:assert/strict');
const {calculate,job,record,server,store}=require('./excel-fixture.cjs');
test('Excel y rótulo: SAP por bobina, lotes con ceros, fechas Lima y un decimal',()=>{
 const r=calculate(),rows=record.rows(r,'2026-11-25T02:30:00Z','abcdefgh');
 assert.equal(rows[0][0],'24/11/2026');assert.equal(rows[0][6],'000123-0');assert.equal(rows[0][7],'01.01.01.100045');assert.equal(rows[0][25],'abcdefgh:1');
 const out=record.labelHTML(r,'2026-11-25T14:30:00Z','data:image/png;base64,abcd');
 assert.match(out,/label-logo/);assert.match(out,/LOTE: 000123-0/);assert.match(out,/01.01.01.100045/);assert.match(out,/160\.7 kg/);assert.doesNotMatch(out,/Libros|Copias|Set up/);
});
test('Varias OP/bobinas: saldos secuenciales, retiros una vez, final sin duplicar',()=>{
 const base={copies:1,advance:1000,setupBooks:0,calibration:false,stops:0};
 const r=calculate([{...base,id:'A',books:5880},{...base,id:'B',books:980}],[{kg:500,width:1000,scrap:10},{kg:500,width:1000,scrap:20,sap:'OTRO-SAP',lot:'000002'}],100);
 const movements=record.movements(r);assert.equal(movements.length,3);
 for(const m of movements)assert.ok(Math.abs(m.opening-m.production-m.deductions-m.balance)<1e-7);
 assert.equal(movements[2].opening,movements[1].balance);assert.equal(movements[2].retired,0);
 assert.ok(Math.abs(movements.reduce((sum,m)=>sum+m.final,0)-r.saldo)<1e-7);
 const rows=record.rows(r,'2026-11-25T14:30:00Z','abcdefgh');assert.deepEqual(rows.map(x=>x[4]),['A','A','B']);assert.equal(rows[1][7],'OTRO-SAP');
});
test('Excel trata como texto SAP y lote, evita fórmulas y escapa el rótulo',()=>{
 const r=calculate(undefined,[{kg:200,sap:'=1+1',lot:'0000<&',description:'<img src=x>'}]);
 assert.equal(record.rows(r,new Date().toISOString(),'abcdefgh')[0][7],"'=1+1");
 const out=record.labelHTML(r,new Date().toISOString());assert.doesNotMatch(out,/<img src=x>/);assert.match(out,/&lt;img/);
 assert.equal(record.missing(calculate(undefined,[{kg:200,sap:''}])).id,'Bobina 1');
});
test('Primer guardado crea el libro, hoja Pruebas y PDF; reintentar no duplica',async()=>{
 const s=server(),j=job(),service=store(s);await service.save(j);
 assert.ok(j.saved&&j.lockReleased);assert.equal(s.sheets.Pruebas.size,1);assert.equal(s.sheets.Registros.size,0);
 const uploads=s.calls.filter(c=>c.options.type==='application/pdf').length;
 await service.save(j);assert.equal(s.sheets.Pruebas.size,1);assert.equal(s.calls.filter(c=>c.options.type==='application/pdf').length,uploads);
 assert.equal(s.sheets.Pruebas.get(2)[23],j.pdfUrl);
});
test('Producción comparte libro; segunda máquina guarda después, sin reemplazar',async()=>{
 const s=server(),a=job(),b=job('ijklmnop-5678');a.snapshot.result.runMode=b.snapshot.result.runMode='production';b.snapshot.result.machine='Kirin 4C';
 await store(s).save(a);await store(s).save(b);
 assert.equal(s.sheets.Registros.size,2);assert.equal(s.sheets.Registros.get(2)[2],'Kirin 1C');assert.equal(s.sheets.Registros.get(3)[2],'Kirin 4C');
 assert.equal([...s.items.values()].filter(x=>x.item.name.endsWith('.xlsx')).length,1);
});
test('Escritura confirmada pero respuesta perdida: recupera las mismas filas',async()=>{
 const s=server(),j=job();let lose=true;
 s.setHook((url,opt)=>{if(lose&&opt.method==='PATCH'&&JSON.parse(opt.body).values){lose=false;throw Error('Respuesta perdida');}});
 await assert.rejects(()=>store(s).save(j),/perdida/);assert.equal(j.saved,undefined);assert.ok(j.plan);assert.equal(s.sheets.Pruebas.size,1);
 await store(s).save(j);assert.ok(j.saved);assert.equal(s.sheets.Pruebas.size,1);assert.equal(s.sheets.Pruebas.get(2)[25],j.id+':1');
});
test('La reserva bloquea otra PC durante un fallo y se libera al recuperar',async()=>{
 const s=server(),a=job(),b=job('ijklmnop-5678');let lose=true;
 s.setHook((url,opt)=>{if(lose&&opt.method==='PATCH'&&JSON.parse(opt.body).values){lose=false;throw Error('Corte de red');}});
 await assert.rejects(()=>store(s).save(a),/Corte/);
 await assert.rejects(()=>store(s).save(b),/Está guardando/);
 await store(s).save(a);await store(s).save(b);assert.equal(s.sheets.Pruebas.size,2);
});
test('Carga de PDF con respuesta perdida se recupera por nombre sin duplicarlo',async()=>{
 const s=server(),j=job();let lose=true;
 s.setHook((url,opt)=>{if(lose&&opt.type==='application/pdf'){lose=false;throw Error('Respuesta perdida');}});
 await store(s).save(j);assert.ok(j.saved);
 assert.equal([...s.items.values()].filter(x=>x.item.name.endsWith('.pdf')).length,1);
});
test('Un PDF existente de la misma OP se conserva con sufijo en el nuevo',async()=>{
 const s=server(),a=job(),b=job('ijklmnop-5678');await store(s).save(a);await store(s).save(b);
 assert.notEqual(a.pdfId,b.pdfId);assert.match(b.pdfName,/\(2\)\.pdf$/);assert.equal(s.sheets.Pruebas.size,2);
});
test('Tabla ampliada pero respuesta perdida: solo conserva las filas necesarias',async()=>{
 const s=server();await store(s).save(job());const j=job('ijklmnop-5678');let lose=true;
 s.setHook((url,opt)=>{if(lose&&url.endsWith('/rows/add')){lose=false;throw Error('Respuesta perdida');}});
 await assert.rejects(()=>store(s).save(j),/perdida/);await store(s).save(j);
 assert.equal(s.counts.Pruebas,3);assert.equal(s.sheets.Pruebas.size,2);
});
test('Sin permiso o con columnas cambiadas no marca guardado ni deja bloqueo',async()=>{
 const s=server(),j=job();s.setHook(url=>{if(url.includes('headerRowRange'))throw Object.assign(Error('Permisos'),{status:403});});
 await assert.rejects(()=>store(s).save(j),/Permisos/);assert.equal(j.saved,undefined);
 s.setHook(null);await store(s).save(job('ijklmnop-5678'));assert.equal(s.sheets.Pruebas.size,1);
});
test('Bobina agotada: registra saldo cero sin fabricar un rótulo de devolución',async()=>{
 const base={id:'A',books:100,copies:1,advance:1000,setupBooks:0,calibration:false,stops:0};
 const r=calculate([base],[{kg:4.32}]);assert.equal(record.labelHTML(r,new Date().toISOString()),'');
 const s=server(),j=job('abcdefgh-1234',r);await store(s).save(j);assert.ok(Math.abs(s.sheets.Pruebas.get(2)[14])<1e-8);
});

test('Excel independiente: nunca genera ni sube PDF',async()=>{
 const s=server(),j=job();j.kind='excel';await store(s,()=>{},async()=>{throw Error('No debe renderizar PDF');}).save(j);
 assert.ok(j.saved);assert.equal(j.pdfId,undefined);assert.equal(s.calls.filter(c=>c.options.type==='application/pdf').length,0);
});
test('PDF independiente: no crea ni toca un Excel',async()=>{
 const s=server(),j=job();j.kind='pdf';s.cloud.pdfDestination={drive:'drive',id:'root'};await store(s).savePDF(j);
 assert.ok(j.saved);assert.equal(s.calls.filter(c=>c.url.includes('/workbook')||c.url.includes('.xlsx')).length,0);
 assert.equal([...s.items.values()].filter(x=>x.item.name.endsWith('.pdf')).length,1);
});

test('Excel y PDF usan la OP y la Kirin en el nombre; un pendiente anterior conserva el libro histórico',async()=>{
 const s=server(),j=job();j.kind='excel';j.naming=2;
 await store(s).save(j);
 const expected=j.snapshot.result.sourceOps[0].id+'_KIRIN1C';
 assert.ok([...s.items.values()].some(x=>x.item.name===expected+'.xlsx'));
 const p=job('ijklmnop-5678');p.kind='pdf';await store(s).savePDF(p);
 assert.equal(p.pdfName,expected+'.pdf');
 assert.equal(record.filename({sourceOps:[{id:'A/1'},{id:'B-2'}],machine:'Kirin 4C'},'xlsx'),'A-1_B-2_KIRIN4C.xlsx');
 const old=job('oldjob-5678');old.kind='excel';await store(s).save(old);
 assert.ok([...s.items.values()].some(x=>x.item.name==='Registro_Bobinas_Cimagraf.xlsx'));
});
