# PDF directo a OneDrive — v4.12.2

Se usa Microsoft Graph con autenticación delegada, sin Power Automate,
servidor propio ni secreto de cliente. La aplicación y el inquilino son los
identificadores facilitados por el propietario. El URI SPA debe ser exactamente
https://richard21ps.github.io/cimagraf-consumo-bobinas/

Permiso delegado: Files.ReadWrite. Microsoft puede exigir aprobación según
la política del inquilino. Cada cuenta debe tener edición en la carpeta destino.
La configuración de permisos por sí sola no equivale al consentimiento.

## Operación

1. Pulsar «Enviar a Forms»: abre el formulario e inicia el guardado del PDF.
2. La carpeta común se selecciona automáticamente: REGISTRO DE PDF DIGITAL
   del OneDrive de richard.pereyra@cimagraf.com.pe. Iniciar sesión si hace falta.
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

La ubicación fue confirmada al abrir el vínculo facilitado por el propietario:
/personal/richard_pereyra_cimagraf_com_pe/Documents/REGISTRO DE PDF DIGITAL.
cloud-destination.js fija owner y path, sin incluir el enlace de uso compartido.
Graph resuelve /users/{owner}/drive/root:/{path} con la sesión de la cuenta activa
y devuelve driveId y folderId. La carga conserva las comprobaciones de tamaño
e identificador del archivo. No se solicita un enlace por equipo ni se crea
una carpeta alternativa si falta acceso. Los permisos de edición siguen siendo
necesarios; esta configuración no concede permisos ni cambia los existentes.

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

## Destino común activado — v4.12.2

La ruta owner/path tiene prioridad sobre configuraciones locales anteriores.
El apartado para introducir vínculos queda oculto y el destino común aparece
junto al estado del PDF. Las pruebas cubren un navegador sin configuración,
una configuración local distinta y una denegación de permisos. La primera carga
real con esta ruta debe comprobarse con una cuenta autorizada.
