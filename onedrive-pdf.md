# PDF en OneDrive · 5.0.0

Guardar PDF genera el PDF usando el mismo HTML de Imprimir rótulos.
record-data.js y labels.css definen el rótulo; report-pdf.js lo convierte a
A4 vertical, con margen de 12 mm y logo decodificado antes de capturar.
El PDF conserva el aspecto impreso mediante imágenes; no es texto seleccionable.

Destino: REGISTRO DE BOBINAS KIRIN 1C o REGISTRO DE BOBINAS KIRIN 4C. No hay carpetas por OP.
Nombre: D13924 - Kirin 1C.pdf; varias OP: D13924 ／ D13925 - Kirin 1C.pdf.
La barra Unicode U+FF0F evita el separador de rutas ASCII. Si ya existe un
archivo, se conserva y el nuevo recibe (2), (3), etc.

Cada bobina utilizada con saldo tiene una página. Si todas se agotaron,
se archiva el resumen de consumo del grupo. Los pesos se muestran a un
decimal, conservando precisión en Excel.

Se reutiliza la aplicación corporativa y Files.ReadWrite delegado. MSAL
Browser 5.27.0 y html2pdf.js 0.14.0 se cargan bajo demanda desde jsDelivr,
con versión e integridad SHA-384 fijadas. No hay contraseña ni secreto de
aplicación en el repositorio; no se alteran permisos de OneDrive.

Ver PDF y Ver Excel se habilitan tras confirmar el guardado. Los reintentos
recuperan el mismo grupo. Consultar registro-excel.md para uso y recuperación.
