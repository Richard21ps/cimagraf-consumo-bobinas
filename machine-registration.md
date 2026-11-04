# Máquinas y numeración · v4.16.0

## Uso

Mismo enlace en las dos PC. En **Configurar equipo**, elegir Kirin 1C o Kirin 4C una sola vez. La selección se conserva en ese navegador.

Por defecto sigue en **PRUEBAS**. Sus IDs llevan `PRUEBA ·` y no gastan números de producción. Los registros de prueba siguen usando el Forms y el archivo PDF existentes; no constituyen otro formulario.

Desde v4.16.2 están conectados los campos Máquina e ID de registro del enlace suministrado por el propietario. **Iniciar producción** se habilita al asignar la PC y muestra una confirmación dentro de la calculadora. Al activar, el estado pasa de PRUEBAS a PRODUCCIÓN y el botón desaparece. Cada máquina lleva su secuencia: `KIRIN 1C - 01`, `KIRIN 4C - 01`, etc. La publicación no activa ninguna máquina ni reserva números reales.

El número mostrado antes de enviar es provisional. Se reserva al pulsar **Enviar a Forms**, después de validar los datos. Cambios o reintentos del mismo grupo conservan el ID; **Ya envié · Siguiente grupo** prepara otro. El registro dentro de Forms todavía requiere pulsar Enviar y comprobar su confirmación.

Desde v4.16.3, el formato visible es `KIRIN 1C - 01` o `KIRIN 4C - 01`; sigue 02, 03… 99, 100. No cambia el número reservado ni los nombres de los archivos centrales. Un envío pendiente de una versión anterior conserva su ID original hasta terminar.

## Conectar el mismo Forms

Crear estas preguntas **Texto**, respuesta corta, sin restricción numérica:

1. **Máquina**
2. **ID de registro**

Durante la transición, dejarlas opcionales para conservar la compatibilidad con las calculadoras que todavía no hayan recargado. No modificar preguntas ni respuestas previas.

Las claves configuradas en `machine-form.js` son `rf61ceca70fda4a82ab4b2ec79e62e708` (Máquina) y `r170d3c85f72f4039b76d820bf026821b` (ID de registro). La calculadora sustituye los ejemplos del vínculo por la máquina y el ID del grupo actual. Si se recrean las preguntas, será necesario actualizar sus claves. Las dos columnas pertenecen al mismo Forms; no se escribe directamente en el Excel.

## Persistencia central

Se usa la conexión delegada a Microsoft Graph que ya guarda PDF. No añade secretos, permisos, Power Automate ni otra base de datos. Dentro de la carpeta de PDF se crea `_CONTROL_CALCULADORA`, con subcarpetas `kirin-1c` y `kirin-4c`.

Cada número es un archivo JSON inmutable con nombre numérico y un UUID del intento. La creación exige `@microsoft.graph.conflictBehavior=fail`: una colisión no reemplaza un ID anterior. La búsqueda incluye todas las páginas. El intento se conserva antes de escribir para recuperar la misma reserva si se pierde la respuesta. Una PC nueva continúa desde los registros centrales. No borrar ni renombrar esta carpeta o sus archivos de control.

Un error de red o un abandono posterior a la reserva puede dejar un número sin respuesta Forms; no se reutiliza. El ID cuenta la apertura del registro desde la calculadora, no una confirmación automática de Forms. La asignación local del equipo es una preferencia, no una barrera de autenticación; se utiliza el acceso Microsoft ya existente a la carpeta compartida.

Referencias: https://learn.microsoft.com/graph/api/resources/driveitem y https://learn.microsoft.com/graph/api/driveitem-post-children .

## Pruebas

`node tests/registration.test.cjs` cubre independencia de máquinas, concurrencia, respuesta perdida, paginación, recuperación de equipo, datos inválidos y activación.

`tests/registration-ui.html` permite verificar el flujo completo con los botones y el motor reales, usando Microsoft, archivos y almacenamiento simulados. Nunca crea respuestas ni archivos de producción.
