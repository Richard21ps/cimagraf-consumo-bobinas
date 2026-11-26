/* Rutas confirmadas en las cuatro carpetas compartidas por el propietario. */
window.CimagrafPDFDestination=Object.freeze({owner:'richard.pereyra@cimagraf.com.pe',path:'REGISTRO DE PDF DIGITAL'});
window.CimagrafDestinations=Object.freeze({
 'kirin-1c':{excel:'BASE DE DATOS KIRIN 1C',pdf:'REGISTRO DE BOBINAS KIRIN 1C',book:'Registro_Kirin_1C.xlsx'},
 'kirin-4c':{excel:'BASE DE DATOS KIRIN 4C',pdf:'REGISTRO DE BOBINAS KIRIN 4C',book:'Registro_Kirin_4C.xlsx'}
});
/* Activar solo con la biblioteca y las cinco carpetas verificadas en SharePoint.
   Formato: {driveId, controlId, folders:{'kirin-1c':{excel,pdf}, 'kirin-4c':{excel,pdf}}}.
   Son identificadores de Microsoft Graph, no enlaces de uso compartido. */
window.CimagrafSharePointDestination=null;
