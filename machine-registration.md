# Máquinas y numeración · v4.16.0

## Uso

Mismo enlace en las dos PC. En **Configurar equipo**, elegir Kirin 1C o Kirin 4C una sola vez. La selección se conserva en ese navegador.

Por defecto sigue en **PRUEBAS**. Sus IDs llevan `PRUEBA ·` y no gastan números de producción. Los registros de prueba siguen usando el Forms y el archivo PDF existentes; no constituyen otro formulario.

La activación de producción queda pendiente hasta conectar los dos campos nuevos de Forms. Después se habilita **Iniciar producción**; muestra una confirmación dentro de la calculadora. Al activar, el botón desaparece. Cada máquina lleva su secuencia: `KIRIN 1C-0001`, `KIRIN 4C-0001`, etc.

El número mostrado antes de enviar es provisional. Se reserva al pulsar **Enviar a Forms**, después de validar los datos. Cambios o reintentos del mismo grupo conservan el ID; **Ya envié · Siguiente grupo** prepara otro. El registro dentro de Forms todavía requiere pulsar Enviar y comprobar su confirmación.

## Conectar el mismo Forms

Crear estas preguntas **Texto**, respuesta corta, sin restricción numérica:

1. **Máquina**
2. **ID de registro**

Durante la transición, dejarlas opcionales para conservar la compatibilidad con las calculadoras que todavía no hayan recargado. No modificar preguntas ni respuestas previas.

Generar un enlace con respuestas predefinidas colocando `Kirin 1C` en Máquina y `KIRIN 1C-0001` en ID de registro. Copiar el enlace completo para extraer sus dos claves `r...` y completar `machine-form.js`. Las dos columnas se incorporan a la tabla de respuestas del mismo Forms; no se escribe directamente en el Excel.

## Persistencia central

Se usa la conexión delegada a Microsoft Graph que ya guarda PDF. No añade secretos, permisos, Power Automate ni otra base de datos. Dentro de la carpeta de PDF se crea `_CONTROL_CALCULADORA`, con subcarpetas `kirin-1c` y `kirin-4c`.

Cada número es un archivo JSON inmutable con nombre numérico y un UUID del intento. La creación exige `@microsoft.graph.conflictBehavior=fail`: una colisión no reemplaza un ID anterior. La búsqueda incluye todas las páginas. El intento se conserva antes de escribir para recuperar la misma reserva si se pierde la respuesta. Una PC nueva continúa desde los registros centrales. No borrar ni renombrar esta carpeta o sus archivos de control.

Un error de red o un abandono posterior a la reserva puede dejar un número sin respuesta Forms; no se reutiliza. El ID cuenta la apertura del registro desde la calculadora, no una confirmación automática de Forms. La asignación local del equipo es una preferencia, no una barrera de autenticación; se utiliza el acceso Microsoft ya existente a la carpeta compartida.

Referencias: https://learn.microsoft.com/graph/api/resources/driveitem y https://learn.microsoft.com/graph/api/driveitem-post-children .

## Pruebas

`node tests/registration.test.cjs` cubre independencia de máquinas, concurrencia, respuesta perdida, paginación, recuperación de equipo, datos inválidos y activación.

`tests/registration-ui.html` permite verificar el flujo completo con los botones y el motor reales, usando Microsoft, archivos y almacenamiento simulados. Nunca crea respuestas ni archivos de producción.
