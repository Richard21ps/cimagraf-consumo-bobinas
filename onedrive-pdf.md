# PDF directo a OneDrive — v4.12.0

Se usa Microsoft Graph con autenticación delegada, sin Power Automate,
servidor propio ni secreto de cliente. La aplicación y el inquilino son los
identificadores facilitados por el propietario. El URI SPA debe ser exactamente
https://richard21ps.github.io/cimagraf-consumo-bobinas/

Permiso delegado: Files.ReadWrite. Microsoft puede exigir aprobación según
la política del inquilino. Cada cuenta debe tener edición en la carpeta destino.
La configuración de permisos por sí sola no equivale al consentimiento.

## Operación

1. Pulsar «Enviar a Forms»: abre el formulario e inicia el guardado del PDF.
2. Configurar la carpeta una sola vez por equipo e iniciar sesión si hace falta.
   El trabajo y el vínculo precargado de Forms se conservan durante el retorno.
3. La confirmación de Graph marca el PDF guardado; NO borra el trabajo ni
   certifica que Forms recibió la respuesta.
4. Completar Forms y esperar su confirmación. Pulsar «Ya envié · Siguiente
   grupo» para limpiar únicamente después de guardar el PDF.

Nombre: OP_<OP1>_<OP2>_<fecha y hora Lima>_<id corto>.pdf. Las OP son la parte
principal; fecha e identificador evitan reemplazar otro trabajo con la misma OP.
El resumen del grupo sigue siendo un solo PDF, con todas las OP y bobinas.

Si el iframe redirige a login.microsoftonline.com, Microsoft impide cargar esa
pantalla de autenticación dentro del marco. Revisar la configuración de Forms
«Cualquier persona puede responder». El enlace alternativo precargado permanece
visible, sin alterar permisos del formulario ni enviar respuestas de prueba.

La carpeta se resuelve mediante /shares/{shareId}/driveItem y sus identificadores
se guardan en localStorage del equipo. El vínculo compartido no se publica
ni se incorpora al repositorio. Mientras se inicia sesión queda únicamente
en sessionStorage; se retira después del guardado correcto.

El nombre usa las OP, fecha/hora y un identificador del registro. Los reintentos del mismo
registro escriben el mismo archivo; un nuevo registro obtiene otro UUID.
Esto no deduplica respuestas duplicadas enviadas por separado a Forms.

Los errores mantienen el registro pendiente y bloquean la edición del trabajo
hasta guardar. No reenviar Forms: usar «Reintentar guardar PDF». La recuperación
se limita a la misma pestaña/sesión del navegador. Cerrar la sesión o borrar
sus datos puede eliminar el trabajo pendiente, que todavía no es un archivo
archivado en OneDrive.

Las bibliotecas MSAL Browser 5.27.0 y jsPDF 4.2.1 se cargan bajo demanda desde
jsDelivr con versiones fijadas y SHA-384. Los tokens se administran mediante
MSAL con caché de sesión, no se incorporan al código ni se registran en logs.

## Validación

- 59 pruebas existentes del motor y Forms.
- tests/cloud-pdf.test.cjs: carga simulada, permisos denegados, reintentos,
  recuperación, nombre estable y conservación de datos.
- PDF real generado con jsPDF y logo, texto y render revisados.
- La carga real necesita completar el inicio de sesión y confirmar el permiso
  de edición en la carpeta. No se envían respuestas de prueba a Forms.

## Destino común — preparación v4.12.1

cloud-destination.js admite driveId y folderId comunes para todos los equipos.
Si ambos están definidos, prevalecen sobre el destino local, la carga no pide
vínculo y el apartado de configuración por equipo se oculta. La autenticación
y los permisos de edición siguen siendo necesarios.

El destino común sigue pendiente de recibir los identificadores reales. Para
obtenerlos, en el navegador donde ya se guardó un PDF abrir «Administración de
la carpeta de PDF» y «Mostrar identificadores de la carpeta conectada».
Enviar únicamente ese JSON al mantenedor para completar cloud-destination.js.
No publicar el vínculo compartido ni tokens. Los ID no conceden acceso.
