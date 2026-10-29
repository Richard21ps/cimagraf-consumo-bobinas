# PDF directo a OneDrive — v4.11.0

Se usa Microsoft Graph con autenticación delegada, sin Power Automate,
servidor propio ni secreto de cliente. La aplicación y el inquilino son los
identificadores facilitados por el propietario. El URI SPA debe ser exactamente
https://richard21ps.github.io/cimagraf-consumo-bobinas/

Permiso delegado: Files.ReadWrite. Microsoft puede exigir aprobación según
la política del inquilino. Cada cuenta debe tener edición en la carpeta destino.
La configuración de permisos por sí sola no equivale al consentimiento.

## Operación

1. Enviar el formulario integrado y esperar su confirmación.
2. Pulsar «Ya envié · Guardar PDF». Esta es una confirmación manual: la app
   no puede comprobar el envío de Forms ni obtener su Response ID.
3. La primera vez en cada equipo, pegar el vínculo de la carpeta de OneDrive
   de Cimagraf en el apartado que se abre dentro de la ventana de Forms.
4. Iniciar sesión si Microsoft lo solicita. Se usa la misma pestaña; antes
   de salir se conserva el trabajo pendiente en sessionStorage.
5. Solo al confirmar Graph el identificador y tamaño del archivo se limpia
   la calculadora. El vínculo del último PDF queda disponible en pantalla.

La carpeta se resuelve mediante /shares/{shareId}/driveItem y sus identificadores
se guardan en localStorage del equipo. El vínculo compartido no se publica
ni se incorpora al repositorio. Mientras se inicia sesión queda únicamente
en sessionStorage; se retira después del guardado correcto.

El nombre usa grupo, fecha y UUID del registro. Los reintentos del mismo
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
