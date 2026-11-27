/* Comprueba el acceso antes de empezar una OP. Las credenciales se introducen en Microsoft. */
(function(){
'use strict';
if(window.CimagrafLocalMode)return;
const $=id=>document.getElementById(id);
const intro=$('welcome-intro'), dialog=$('access-dialog'), status=$('access-status'), button=$('access-signin');
const panels=[document.querySelector('main.page'),$('cloud-panel')];
panels.forEach(panel=>{panel.inert=true;});
let ready=false,observer;
function show(){
 if(ready||dialog.open)return;
 dialog.showModal();
}
if(intro?.hidden===false){
 observer=new MutationObserver(()=>{if(intro.hidden){observer.disconnect();show();}});
 observer.observe(intro,{attributes:true,attributeFilter:['hidden']});
}else show();
dialog.addEventListener('cancel',e=>e.preventDefault());
function prompt(message,label){
 status.textContent=message;
 button.textContent=label;
 button.hidden=false;button.disabled=false;
 if(dialog.open)button.focus();
}
async function check(){
 try{
  const result=await window.CimagrafCloud.verifySession();
  if(result==='ready'){
   ready=true;observer?.disconnect();
   if(dialog.open)dialog.close();
   panels.forEach(panel=>{panel.inert=false;});
  }else if(result==='denied')prompt('Esta cuenta no está habilitada. Selecciona una cuenta corporativa autorizada de Kirin.','Usar otra cuenta de Microsoft');
  else prompt('Ingresa con tu cuenta corporativa para empezar.','Iniciar sesión con Microsoft');
 }catch(_){prompt('No pudimos verificar tu sesión. Revisa tu conexión o vuelve a iniciar sesión.','Iniciar sesión con Microsoft');}
}
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='Abriendo Microsoft…';
 try{await window.CimagrafCloud.signIn();}
 catch(_){prompt('No se pudo abrir Microsoft. Vuelve a intentarlo.','Reintentar inicio de sesión');}
});
check();
})();
