# Registro directo en Excel · 5.0.0

La calculadora sustituye la integración de Forms por **Guardar en Excel**.
Conserva GitHub Pages, la aplicación Microsoft y la carpeta automática
`REGISTRO DE PDF DIGITAL`. No usa Power Automate ni secretos de cliente.
No modifica ni elimina el formulario o sus respuestas existentes.

## Uso

1. Elegir Kirin 1C o Kirin 4C una sola vez en Configurar equipo.
2. Llenar material, gramaje, ancho, OP, set up, corrida y bobinas.
3. Cada bobina tiene **lote** y **SAP propios**, y una descripción opcional
   copiada del rótulo original. No se deducen marcas ni certificaciones.
4. **Imprimir rótulos** imprime A4 horizontal, una hoja por bobina con saldo:
   SAP, material, gramaje, ancho, descripción, OP, lote, peso neto calculado
   a un decimal y fecha de Lima. Las agotadas no generan rótulo de devolución.
5. **Guardar en Excel** conserva los datos antes de autenticar, guarda PDF
   y escribe las filas. Solo confirma Guardado tras leer las celdas escritas.
6. **Siguiente grupo** se habilita al confirmar Excel y PDF.

La cuenta Microsoft debe tener edición en la carpeta y permiso para usar
las API de Excel. Se reutiliza Files.ReadWrite delegado. Si la política
corporativa o el acceso compartido deniegan la operación, el administrador
debe resolver el permiso. El código no concede acceso a OneDrive.

## Libro y filas

En el primer guardado se crea automáticamente, si no existe,
**Registro_Bobinas_Cimagraf.xlsx**, utilizando la plantilla del repositorio.

| Hoja | Tabla | Uso |
| --- | --- | --- |
| Registros | RegistrosBobinas | Producción de ambas máquinas |
| Pruebas | PruebasBobinas | Pruebas de ambas máquinas |

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
