/* Rutas confirmadas en las cuatro carpetas compartidas por el propietario. */
window.CimagrafPDFDestination=Object.freeze({owner:'richard.pereyra@cimagraf.com.pe',path:'REGISTRO DE PDF DIGITAL'});
window.CimagrafDestinations=Object.freeze({
 'kirin-1c':{excel:'BASE DE DATOS KIRIN 1C',pdf:'REGISTRO DE BOBINAS KIRIN 1C',book:'Registro_Kirin_1C.xlsx'},
 'kirin-4c':{excel:'BASE DE DATOS KIRIN 4C',pdf:'REGISTRO DE BOBINAS KIRIN 4C',book:'Registro_Kirin_4C.xlsx'}
});
/* Activar solo con la biblioteca y las cinco carpetas verificadas en SharePoint.
   Formato: {driveId, controlId, folders:{'kirin-1c':{excel,pdf}, 'kirin-4c':{excel,pdf}}}.
   Son identificadores de Microsoft Graph, no enlaces de uso compartido. */
window.CimagrafLocalMode=new URLSearchParams(location.search).get('modo')==='local';
const spPilotParam=new URLSearchParams(location.search).get('prueba');
let spPilot=spPilotParam==='sharepoint';
try{
 const key='cimagraf-sharepoint-pilot';
 if(spPilot)sessionStorage.setItem(key,'1');
 else if(/(?:[?#&])(?:code|error)=/.test(location.hash+location.search))spPilot=sessionStorage.getItem(key)==='1';
 else sessionStorage.removeItem(key);
}catch(_){}
window.CimagrafSharePointPilot=spPilot;
window.CimagrafSharePointDestination=spPilot?Object.freeze({
 driveId:'b!y2wdZFmU-0euXFXXwGZrsPw8RMCCkj5EiJ1NtMplADaAAfuMQyYlSJ2SKgxVF31R',
 controlId:'01C4JOYKM5JMMYM6IS5ZCZKYQ7MQUOJAFF',
 folders:{
  'kirin-1c':{excel:'01C4JOYKPTQER7JWNADBEL6K6CC6PP6UUN',pdf:'01C4JOYKOOXA2YTVS3HZEZDEGP3YLNHWPJ'},
  'kirin-4c':{excel:'01C4JOYKLZGHPAQOPHPVDJ36ILWHQYEEWH',pdf:'01C4JOYKMBFXDXGAKC3VEKW6S3QKKYYBCG'}
 }
}):null;
