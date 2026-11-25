/* SOLO PRUEBAS. Se carga exclusivamente en test-frame.js, nunca en la calculadora. */
(function(){
const saved=new Map(),counters={'kirin-1c':0,'kirin-4c':0};
window.CimagrafCloud={connect:async()=>({destination:{drive:'SIMULADO',id:'SIMULADO'}})};
const registry=window.CimagrafRegistry;
registry.create=()=>({open:async(_,key)=>key,next:async key=>counters[key]+1,reserve:async(key,_,draft)=>{
 if(!saved.has('id-'+draft.id))saved.set('id-'+draft.id,++counters[key]);
 const number=saved.get('id-'+draft.id);return {number,recordId:registry.recordId(key,number)};
}});
window.CimagrafExcelStore={create:({remember})=>({save:async job=>{
 job.pdfStarted=true;job.plan={start:2};remember(job);
 if(parent.CimagrafDemoDelay)await parent.CimagrafDemoDelay();
 if(parent.CimagrafDemoFail?.())throw Error('Corte de red simulado');
 if(!saved.has(job.id))saved.set(job.id,window.CimagrafRecord.rows(job.snapshot.result,job.created,job.id,'https://ejemplo.sharepoint.com/pdf'));
 job.saved=true;job.lockReleased=true;job.pdfUrl='https://ejemplo.sharepoint.com/pdf';job.excelUrl='https://ejemplo.sharepoint.com/excel';remember(job);
 parent.CimagrafDemoSaved?.(saved.get(job.id));
}})};
})();
