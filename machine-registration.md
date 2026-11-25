# Máquinas y numeración · 5.0.0

El mismo enlace sirve para ambas PC. Configurar Kirin 1C o Kirin 4C una sola
vez por navegador. La elección conserva la configuración existente.

Las pruebas van a la hoja Pruebas con PRUEBA · KIRIN 1C - 01 o
PRUEBA · KIRIN 4C - 01. Su contador avanza al confirmar Excel y PDF y no
consume números de producción.

Iniciar producción confirma el modo real y oculta el botón. Cada máquina
conserva su secuencia KIRIN 1C - 01 o KIRIN 4C - 01. Publicar no activa las
máquinas ni borra reservas. Una máquina activada no debe iniciar otra vez.

El número previo al guardado es provisional. Guardar en Excel lo reserva
en _CONTROL_CALCULADORA/kirin-1c o kirin-4c, con los archivos JSON inmutables
de la implementación existente. Reintentos conservan la misma reserva.
Siguiente grupo prepara otro número tras confirmar Excel y PDF.

Una reserva abandonada puede dejar un salto; no se reutiliza ni se sobrescribe.
El intento se conserva antes de escribir para recuperar una respuesta perdida.
Una PC nueva consulta el control central y continúa. No borrar ni renombrar
archivos de control. La máquina es una preferencia del navegador; el acceso
a OneDrive corresponde a la cuenta Microsoft corporativa.

Las pruebas registration.test.cjs y direct-ui.test.cjs comprueban numeración
independiente, concurrencia y recuperación. Ver registro-excel.md.
