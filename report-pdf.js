/* Renderiza la misma plantilla HTML y CSS de impresión, sin descargar archivos. */
(function(){
'use strict';
let loading;
function renderer(){
 if(window.html2pdf)return Promise.resolve();
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const el=document.createElement('script');
  el.src='https://cdn.jsdelivr.net/npm/html2pdf.js@0.14.0/dist/html2pdf.bundle.min.js';
  el.integrity='sha384-EaWTV/aVUkLz3tfwg3+5ycX7Q/d9ET9ruOKUgUuFIRUCfzHO1eo2J62a844iWPmY';
  el.crossOrigin='anonymous';el.onload=resolve;
  el.onerror=()=>{el.remove();loading=null;reject(new Error('No se pudo preparar el PDF. Revisa Internet y reintenta.'));};
  document.head.append(el);
 });return loading;
}
window.CimagrafReportPDF={async render(html){
 await renderer();
 const report=document.createElement('section');report.className='cimagraf-report';report.innerHTML=html;
 if(document.fonts?.ready)await document.fonts.ready;
 await Promise.all([...report.querySelectorAll('img')].map(img=>img.decode()));
 return window.html2pdf().set({
  margin:12,
  image:{type:'jpeg',quality:0.98},
  html2canvas:{scale:2,backgroundColor:'#ffffff',useCORS:false,logging:false,windowWidth:1000,scrollX:0,scrollY:0},
  jsPDF:{unit:'mm',format:'a4',orientation:'portrait',compress:true},
  pagebreak:{mode:['css','legacy'],avoid:['tr','.print-total','.print-material-strip','.print-heading']}
 }).from(report).toPdf().outputPdf('arraybuffer');
}};
})();
