const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const code=fs.readFileSync(require('node:path').join(__dirname,'../cloud-pdf.js'),'utf8');
function fixture({fail=false,pending=null}={}){
 const elements={},listeners=new Map();const el=id=>elements[id]??=( {value:'',classList:{toggle(){},add(){},contains(){return true;}},addEventListener:(event,fn)=>listeners.set(id+event,fn),focus(){},hidden:false,disabled:false});
 const session=new Map(pending?[['cimagraf-pdf-pending-v1',JSON.stringify(pending)]]:[]),local=new Map([['cimagraf-pdf-folder-v1',JSON.stringify({drive:'drive',id:'folder'})]]);
 const storage=m=>({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)});
 let resets=0,restores=0;const calls=[],printed=[];
 const r={group:'01/02',paper:'Bond',gsm:90,saldo:178.63,sourceOps:[{id:'OP1',books:1000,copies:20,advance:240}],sums:[{metros:4800,kg:207.36}],details:[{op:'OP1',bobina:'Bobina 1',ancho:480,kg:207.36,saldo:178.63}],usedRolls:[{id:'Bobina 1',width:480,initial:400,used:207.36,retired:5,corePaper:9.01,left:178.63,problems:['Daño'],areas:['Almacén']}]};
 class Auth{async initialize(){}async handleRedirectPromise(){}getActiveAccount(){return {username:'test'};}async acquireTokenSilent(){return {accessToken:'test-token'};}}
 class Doc{setFont(){}setFontSize(){}splitTextToSize(v){return [v];}text(v){printed.push(v);}setTextColor(){}addPage(){}output(){return new ArrayBuffer(123);}}
 const context={window:{msal:{PublicClientApplication:Auth},jspdf:{jsPDF:Doc},CimagrafArchive:{snapshot:()=>({result:r}),restore:()=>restores++,resume:()=>{},reset:()=>resets++}},document:{body:{classList:{add(){}}},getElementById:el,querySelector:()=>null,addEventListener(){},head:{append(){throw new Error('Unexpected remote dependency');}}},msal:{PublicClientApplication:Auth},jspdf:{jsPDF:Doc},sessionStorage:storage(session),localStorage:storage(local),URL,Intl,Date,ArrayBuffer,encodeURIComponent,unescape,btoa:s=>Buffer.from(s,'binary').toString('base64'),location:{hash:'',search:''},crypto:require('node:crypto').webcrypto,fetch:async(url,options)=>{calls.push({url,options});return {ok:!fail,status:fail?403:200,json:async()=>fail?{error:{code:'accessDenied'}}:{id:'uploaded',size:123,webUrl:'https://grupocimagraf-my.sharepoint.com/pdf'}};}};
 vm.createContext(context);vm.runInContext(code.replace(/\}\)\(\);\s*$/, 'window.testCloud={save,finish,folderLink,shareId,filename,pdf,setJob:j=>job=j};})();'),context);
 return {context,el,session,local,listeners,calls,printed,r,api:context.window.testCloud,get resets(){return resets;},get restores(){return restores;}};
}
(async()=>{
 let f=fixture(),j={id:'uuid',created:'2026-10-29T03:00:00Z',snapshot:{result:f.r}};
 assert.equal(f.api.filename(j),'OP_OP1_20261028220000_uuid.pdf');
 assert.throws(()=>f.api.folderLink('https://evil.example/:f:/foo'));
 assert.throws(()=>f.api.folderLink('http://grupocimagraf-my.sharepoint.com/:f:/foo'));
 f.api.setJob(j);await f.api.save();assert.equal(f.resets,0);assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.method,'PUT');assert.equal(f.calls[0].options.headers['Content-Type'],'application/pdf');assert.ok(f.printed.some(t=>t.includes('178.6')));assert.ok(f.printed.some(t=>t.includes('Almacén')));assert.equal(JSON.parse(f.session.get('cimagraf-pdf-pending-v1')).saved,true);await f.api.save();assert.equal(f.calls.length,1);f.api.finish();assert.equal(f.resets,1);assert.equal(f.session.has('cimagraf-pdf-pending-v1'),false);
 f=fixture({fail:true});j={...j,saved:false,snapshot:{result:f.r}};f.api.setJob(j);await f.api.save();assert.equal(f.resets,0);assert.equal(f.el('multi-root').inert,true);assert.ok(f.session.has('cimagraf-pdf-pending-v1'));await f.api.save();assert.equal(f.calls[0].url,f.calls[1].url);assert.equal(f.el('forms-next').disabled,false);
 f=fixture({pending:j});assert.equal(f.restores,1);assert.equal(f.el('multi-root').inert,true);assert.equal(f.el('cloud-retry').hidden,false);
 f=fixture();f.local.clear();f.api.setJob(j);await f.api.save();assert.equal(f.calls.length,0);assert.equal(f.resets,0);assert.equal(f.el('cloud-folder-setup').open,true);
 f=fixture();f.listeners.get('multi-registerclick')();for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,1);assert.equal(f.resets,0);assert.equal(JSON.parse(f.session.get('cimagraf-pdf-pending-v1')).saved,true);
 console.log('PDF: permisos, destino, contenido, carga, reintento, recuperación y conservación de datos correctos.');
})().catch(e=>{console.error(e);process.exitCode=1;});
