# Guardados independientes · 5.1.1

El rótulo usa el formato 1: A4 vertical, una página por bobina con saldo,
con SAP, material/gramaje, ancho, descripción opcional, OP, lote, kg y fecha.
Imprimir y Guardar PDF comparten HTML/CSS. Los nombres PDF conservan OP y máquina.

| Máquina | Excel | PDF |
| --- | --- | --- |
| Kirin 1C | BASE DE DATOS KIRIN 1C/Registro_Kirin_1C.xlsx | REGISTRO DE BOBINAS KIRIN 1C |
| Kirin 4C | BASE DE DATOS KIRIN 4C/Registro_Kirin_4C.xlsx | REGISTRO DE BOBINAS KIRIN 4C |

Las cuatro carpetas compartidas se comprobaron vacías. El primer guardado
crea el libro de su máquina utilizando la plantilla del repositorio.
Guardar en Excel no renderiza ni carga PDF. Guardar PDF no escribe en Excel.
Se puede guardar primero cualquiera; después de Excel, el botón de PDF del
panel conserva la misma instantánea confirmada y permite terminar el grupo.
Guardar únicamente PDF no confirma el registro de Excel ni avanza su contador.
La numeración central existente conserva su carpeta de control original.
Se reutiliza la sesión Microsoft corporativa con edición en los destinos.
No se incluyen vínculos de uso compartido ni tokens en el código público.

Los pendientes anteriores sin tipo explícito conservan su flujo y destino
original para evitar perder una reserva ya escrita. Las reglas siguientes
sobre filas, recuperación y validación siguen vigentes para Excel:

## Libro y filas

En el primer guardado se crea automáticamente, si no existe, el libro de
la máquina indicado arriba, utilizando la plantilla del repositorio.

| Hoja | Tabla | Uso |
| --- | --- | --- |
| Registros | RegistrosBobinas | Producción de la máquina del libro |
| Pruebas | PruebasBobinas | Pruebas de la máquina del libro |

Una fila corresponde a un movimiento de **OP y bobina**. Una OP que usa
varias bobinas se repite. Si varias OP comparten bobina, el cierre anterior
es la apertura siguiente. Lonjas y sobrante neto se descuentan solo en su
primera fila. SAP y lote se guardan como texto, conservando ceros iniciales.

Producción (kg) es corrida. Descuentos (kg) agrupa proceso, lonjas y sobrante
neto. Inicio − Producción − Descuentos = Saldo, sin redondear internamente.
Metros incluye corrida y proceso. **Devolución final (kg)** lleva el saldo
solo en la última fila de cada bobina: sumar esta columna evita sumar los
saldos intermedios. Una bobina retirada totalmente antes de máquina se
asocia a la primera OP del grupo, con producción cero.

Motivos, áreas y enlace PDF quedan en columnas separadas. No cambiar los
encabezados ni los nombres de tablas/hojas. Se pueden usar filtros; para
reordenar o analizar libremente, usar una copia y mantener estable la tabla
de captura mientras las máquinas guardan.

La calibración conserva 26 m en Kirin 1C (6 + 20) y 19 m en Kirin 4C
(6 + 13), confirmado por el propietario el 25/11/2026. Los blancos de set up
y paradas son 20 m y 13 m respectivamente; el empalme mantiene 20 m.

## Recuperación y concurrencia

El navegador conserva el pendiente antes de iniciar sesión. La carpeta
`_CONTROL_CALCULADORA` coordina la numeración y un turno único de escritura
en Excel. `REGISTROS_EXCEL` conserva un diario inmutable con las filas
reservadas para cada guardado.

Los reintentos escriben en las mismas direcciones y comprueban que no haya
otro registro. Ampliar la tabla solo agrega filas vacías, por lo que una
respuesta perdida no vuelve a insertar movimientos. Los PDF no reemplazan
archivos anteriores; otro registro con el mismo nombre recibe (2), (3), etc.

Un corte después de reservar filas mantiene el turno para ese grupo.
**Reintentar guardado** recupera el registro y libera el turno al confirmar.
Si la otra PC indica que una máquina está guardando, resolver primero el
pendiente de esa máquina. No borrar datos del navegador ni archivos de
control para destrabarlo. No hay caducidad automática que permita reemplazar
una escritura todavía activa.

Si se pierde definitivamente el equipo que retiene el turno, un administrador
debe comparar el diario con las filas y verificar que no hay escrituras
activas antes de recuperar el control.

## Verificación

Si Microsoft devuelve `invalidRequest` al abrir una carpeta por correo,
solo cuando la sesión coincide con el propietario configurado se resuelve
su propio OneDrive mediante `/me/drive` y se reintenta la misma carpeta por
ID. No se cambia el destino a la cuenta de otro maquinista.
Los fallos muestran un detalle plegable con el paso, estado, código,
mensaje de Microsoft y referencia de solicitud. No guarda credenciales ni
URL preautorizadas de carga. Un reintento exitoso oculta el detalle.
El ajuste de conexión debe confirmarse también con una sesión real.

`node --test tests/*.test.cjs`: cálculo, catálogos, saldos, taras, reglas por
máquina, numeración, rótulos, escritura, concurrencia y respuestas perdidas.
`tests/direct-save.html`: editor real con servicios y almacenamiento aislados.
`tests/pdf-layout.html`: rótulos y PDF ficticios sin escribir en Microsoft.

Las simulaciones no sustituyen la primera escritura con una sesión Microsoft
autorizada. La publicación no crea el Excel hasta el primer Guardar en Excel.

API oficiales: [rangos](https://learn.microsoft.com/graph/api/range-update),
[filas](https://learn.microsoft.com/graph/api/tablerowcollection-add),
[carga](https://learn.microsoft.com/graph/api/driveitem-createuploadsession),
[eliminación condicional](https://learn.microsoft.com/graph/api/driveitem-delete).
