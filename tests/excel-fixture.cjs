const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {CimagrafRecord:record}=require('../record-data.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('function coreTareFor('),html.indexOf('\nfunction table('));
function calculate(ops=[{id:'D13924',books:100,copies:30,advance:240,setupBooks:10,calibration:true,stops:2}],rolls=[{kg:200}],gsm=75){
 const context={ops:structuredClone(ops),rolls:rolls.map((r,i)=>({id:'Bobina '+(i+1),lot:'000123-'+i,sap:'01.01.01.100045',description:'PEFC 70% CHAMBRIL DIGITAL (IMP)',width:480,scrap:0,coreGross:0,coreTare:0,...r})),numeric:x=>x===''?NaN:Number(x),$:id=>({value:id==='multi-gsm'?String(gsm):'Bond'})};
 vm.createContext(context);const r=vm.runInContext(source+';validate()',context);
 return Object.assign(r,{machine:'Kirin 1C',machineKey:'kirin-1c',runMode:'test',recordId:'PRUEBA · KIRIN 1C - 01',group:'PRUEBA · KIRIN 1C - 01'});
}
function job(id='abcdefgh-1234',r=calculate()){return {id,created:'2026-11-25T14:30:00Z',snapshot:{result:JSON.parse(JSON.stringify(r))}};}
const fail=status=>Object.assign(Error('Falla simulada '+status),{status});
function server(){
 const paths=new Map(),items=new Map(),calls=[],sheets={Registros:new Map(),Pruebas:new Map()},counts={Registros:2,Pruebas:2};let serial=0,hook;
 const root='/drives/drive/items/root';
 paths.set(root,{id:'root',name:'REGISTRO DE PDF DIGITAL',folder:{}});
 const meta=(parent,name,folder,data)=>{
  const id='item-'+(++serial),item={id,name,eTag:'etag-'+serial,webUrl:'https://empresa.sharepoint.com/'+encodeURIComponent(name),...(folder?{folder:{}}:{size:data?.length??0})};
  paths.set(parent+':/'+encodeURIComponent(name),item);items.set(id,{item,data,parent});return item;
 };
 async function request(url,options={}){
  calls.push({url,options});await new Promise(r=>setImmediate(r));
  let answer;
  const match=/\/workbook\/(tables\/([^/]+)\/(headerRowRange|range|rows\/add)|worksheets\/([^/]+)\/range\(address='A(\d+):Z(\d+)'\))/.exec(url);
  if(match){
   const sheet=match[4]||(match[2]==='RegistrosBobinas'?'Registros':'Pruebas');
   if(match[3]==='headerRowRange')answer={values:[record.headers.slice()]};
   else if(match[3]==='range')answer={columnCount:26,columnIndex:0,rowIndex:0,rowCount:counts[sheet]};
   else if(match[3]==='rows/add'){const body=JSON.parse(options.body);counts[sheet]+=body.values.length;answer={index:counts[sheet]-body.values.length-1};}
   else{
    const a=Number(match[5]),b=Number(match[6]);
    if(options.method==='PATCH'){const body=JSON.parse(options.body);if(body.values)body.values.forEach((row,i)=>sheets[sheet].set(a+i,row.map(v=>typeof v==='string'?v.replace(/^'(?=[=+\-@])/,''):v)));}
    answer={values:Array.from({length:b-a+1},(_,i)=>sheets[sheet].get(a+i)||Array(26).fill(''))};
   }
  }else if(url.endsWith('/children')&&options.method==='POST'){
   const body=JSON.parse(options.body),parent=url.slice(0,-9);if(paths.has(parent+':/'+encodeURIComponent(body.name)))throw fail(409);answer=meta(parent,body.name,true);
  }else if(url.endsWith('/content')){
   const id=url.split('/').at(-2),entry=items.get(id);if(!entry)throw fail(404);answer=JSON.parse(new TextDecoder().decode(entry.data));
  }else if(options.method==='DELETE'){
   const id=url.split('/').at(-1),entry=items.get(id);if(!entry)throw fail(404);
   if(options.headers['If-Match']!==entry.item.eTag)throw fail(412);
   paths.delete(entry.parent+':/'+encodeURIComponent(entry.item.name));items.delete(id);answer=null;
  }else if(paths.has(url))answer=paths.get(url);
  else {const id=url.split('/').at(-1);if(items.has(id))answer=items.get(id).item;else throw fail(404);}
  if(hook)await hook(url,options,answer);return structuredClone(answer);
 }
 async function createFile(parent,name,data,type){
  calls.push({url:parent+':/'+name,options:{method:'UPLOAD',type}});await new Promise(r=>setImmediate(r));
  if(paths.has(parent+':/'+encodeURIComponent(name)))throw fail(409);
  const item=meta(parent,name,false,new Uint8Array(data));if(hook)await hook(parent+':/'+name,{method:'UPLOAD',type},item);return structuredClone(item);
 }
 return {cloud:{destination:{drive:'drive',id:'root'},request,createFile},sheets,paths,items,counts,calls,setHook:fn=>hook=fn};
}
function store(s,remember=()=>{},renderPDF=async()=>new Uint8Array(123).buffer){
 const context={module:{exports:{CimagrafRecord:record}},TextEncoder,Uint8Array,URL};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../excel-store.js'),'utf8'),context);
 return context.module.exports.CimagrafExcelStore.create({cloud:s.cloud,remember,renderPDF,loadTemplate:async()=>new Uint8Array([1,2,3]),status(){}});
}
module.exports={calculate,job,record,server,store};
