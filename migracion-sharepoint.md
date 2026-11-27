# Traslado del registro de bobinas a SharePoint

La aplicación admite la biblioteca del sitio privado Registro de Bobinas
Digital con cinco carpetas distintas. El enlace normal guarda en OneDrive.
La URL con `?prueba=sharepoint` guarda datos de ejemplo en SharePoint y
separa los pendientes y la numeración del navegador. No se activa
producción desde el enlace de prueba.

| Uso | Carpeta propuesta | Archivo |
| --- | --- | --- |
| Control compartido | CONTROL DE BOBINAS | `_CONTROL_CALCULADORA`, generado dentro de la carpeta |
| Excel de Kirin 1C | BASE DE DATOS KIRIN 1C | `Registro_Kirin_1C.xlsx` |
| PDF de Kirin 1C | REGISTRO DE BOBINAS KIRIN 1C | Un PDF por OP |
| Excel de Kirin 4C | BASE DE DATOS KIRIN 4C | `Registro_Kirin_4C.xlsx` |
| PDF de Kirin 4C | REGISTRO DE BOBINAS KIRIN 4C | Un PDF por OP |

1. Usar un sitio del equipo identificado por su URL de SharePoint. Crear o
   verificar las cinco carpetas en una misma biblioteca. Registrar el ID de
   unidad de Microsoft Graph y los IDs de las carpetas. Verificar que cada
   ID abre la carpeta prevista dentro de esa biblioteca.
2. Verificar que cada cuenta operadora puede editar su par de carpetas y el
   control compartido. Mantener la autorización delegada de Microsoft Entra:
   cambiar el destino no reemplaza el consentimiento de la aplicación.
3. Probar en SharePoint con las dos cuentas Kirin usando una biblioteca de
   prueba o un despliegue de prueba autorizado. Comprobar escritura real en
   la hoja Pruebas y que el PDF quede en la carpeta de cada máquina.
4. Para producción, pausar los guardados en las dos máquinas y resolver los
   pendientes en su destino original. Copiar los dos Excel consolidados
   conservando sus nombres, tablas y hojas. Copiar las reservas de
   numeración de `_CONTROL_CALCULADORA/kirin-1c` y
   `_CONTROL_CALCULADORA/kirin-4c` y verificar el próximo número en cada
   máquina. No copiar un bloqueo activo ni reutilizar diarios de Excel que
   contienen los IDs de los libros originales. Mantener OneDrive disponible
   como archivo y para recuperación; los vínculos previos pueden apuntar allí.
5. Configurar los IDs en `cloud-destination.js` y publicar la actualización
   del mismo enlace. Recargar las dos máquinas antes de reanudar el trabajo.
   Los grupos nuevos van al nuevo destino. Si un guardado ya había
   reservado número, empezado una escritura o confirmado un archivo, el
   reintento y su segundo guardado conservan el destino original.

Los IDs de carpetas indican la ruta del recurso; no sustituyen los permisos.
No publicar contraseñas, tokens ni vínculos de uso compartido en el repositorio.
