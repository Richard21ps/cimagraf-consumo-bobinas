# Reglas de proceso — 4.19.2

Corrección confirmada por el usuario el 4 de noviembre de 2026. La calibración se corrigió a 26 m el 5 de noviembre de 2026. Los parámetros son por OP:

- Libros de set up: entero >= 0 (valor inicial 0).
- Libros de corrida: entero > 0; conserva el campo interno `books` de Forms/Excel.
- Copias por libro: una sola cantidad común para set up y corrida (`copies`).
- Calibración: checkbox independiente, desmarcado inicialmente.
- Paradas: entero >= 0 (valor inicial 0).

Pase en blanco por máquina: Kirin 1C = 20 m; Kirin 4C = 13 m.
Al cambiar la máquina en el selector se vuelve a calcular con la regla correspondiente.

Metros por OP:

- Corrida = libros de corrida × copias por libro × avance en mm / 1000.
- Set up = libros de set up × (copias por libro × avance en mm / 1000 + pase en blanco).
- Calibración = 6 m de encuadre + pase en blanco (26 m en Kirin 1C y 19 m en Kirin 4C) por OP si está marcada, de lo contrario 0 m. Es independiente de los libros de set up.
- Paradas = cantidad de paradas × (copias por libro × avance en mm / 1000 + pase en blanco).
- Empalmes del grupo = 20 × máximo(cantidad de OP, cantidad de bobinas registradas).

Cada OP recibe una unidad de empalme de 20 m. Si hay más bobinas que OP,
las unidades restantes se asignan a la última OP; este criterio aparece en
el desglose y en la impresión para que los totales por OP sean verificables.
Agregar una bobina registrada aumenta la base de empalmes cuando supera
la cantidad de OP, aunque su saldo completo no sume a la devolución si no se utiliza.

La asignación secuencial se realiza en este orden por OP: set up, calibración,
empalmes, corrida y paradas. El consumo de cada etapa usa el ancho real
y el gramaje de la bobina de la que se toma el papel. Una etapa puede cruzar
varias bobinas y no se avanza a la siguiente mientras quede material disponible.

Los kg de corrida y de proceso se conservan por separado. El saldo es:
inicial − lonjas − sobrante neto de papel − corrida − proceso.
Los kg de cartón siguen excluidos según las taras ya configuradas.
El amarillo del gráfico suma lonjas + sobrante neto + proceso; el azul muestra
la corrida. La impresión y el PDF comparten las tablas ampliadas.

## Ejemplo de control — Kirin 1C

100 libros de corrida, 10 libros de set up, 30 copias por libro, avance 240 mm,
calibración marcada, 2 paradas y una bobina:

- Corrida: 100 × 30 × 240 / 1000 = 720 m.
- Set up: 10 × (30 × 240 / 1000 + 20) = 272 m.
- Calibración: 26 m.
- Paradas: 2 × (30 × 240 / 1000 + 20) = 54,4 m.
- Empalme: 20 m.

Total: 1092,4 m. Con ancho 1000 mm, gramaje 100 g/m² y 200 kg iniciales,
sin lonjas ni sobrante: consumo 109,24 kg y devolución 90,76 kg.

## Forms y compatibilidad

Se conservan las preguntas existentes y las primeras nueve columnas del
paquete `CIMAGRAF_OPS_V2`. Metros y kg por OP incluyen todos los consumos.
Las columnas adicionales, desde la décima, contienen:
libros de set up, calibración (0/1), paradas, metros de corrida,
metros de set up, metros de calibración, metros de paradas, metros de empalmes,
kg de corrida, kg de proceso y versión de las reglas (2 para Kirin 1C; 3 para Kirin 4C con 13 m de blanco).
Las preguntas de lonjas/sobrante conservan exclusivamente los pesos introducidos.

No se cambian preguntas ni respuestas de Microsoft Forms ni archivos Excel.
Las instantáneas anteriores se pueden imprimir conservando sus valores originales.
Al volver a editar un registro de la versión 4.15.0, los libros de set up
quedan pendientes de completar: no se convierten las antiguas copias a libros.
Un registro corregido con reglas nuevas no reutiliza un PDF con reglas anteriores.

## Comprobaciones

`tests/process.test.cjs` cubre fórmulas, calibración sin set up, copias comunes,
reglas de empalme, anchos distintos, material insuficiente, saldo cero, taras
y detalle de Forms. Los escenarios históricos de `tests/calculation.test.cjs`
fijan el metraje total incluido el empalme para verificar asignación y masa;
las pruebas nuevas verifican cada componente del metraje.

## Resumen compacto y saldos secuenciales — 4.15.2

La impresión y el PDF automático comparten una tabla con OP, bobina,
saldo inicial, consumo de corrida, descuentos y saldo al cierre.
Los descuentos agrupan proceso, lonjas y sobrante neto de papel.
El cierre real del movimiento anterior es la apertura del siguiente de
la misma bobina; el peso inicial original no se repite como apertura.
Lonjas y sobrante se incluyen únicamente en la primera fila de la bobina.
Una bobina totalmente retirada sin pasar por máquina muestra OP «—»,
consumo cero y el retiro correspondiente.

El material, gramaje y ancho aparecen en la cabecera. No se imprimen
parámetros de entrada ni tablas de metraje, ni se repiten anchos en las tablas.
Al pie se muestran los saldos finales por bobina y el total a entregar.
Los motivos y áreas se mantienen en los registros de cálculo y Forms;
se omiten del resumen compacto.

No se modifica el motor de cálculo ni los saldos: las filas solo muestran
las instantáneas de los movimientos. Las pruebas de impresión comprueban
la cadena 500 → 380 → 280, retiros únicos, bobinas agotadas, anchos distintos,
instantáneas anteriores y ausencia de mutación de los resultados originales.

## Paradas vacías — 4.15.3

El campo Paradas vacío se interpreta como 0 durante la captura y en el motor.
Al salir del campo se muestra automáticamente 0. Los valores negativos,
fraccionarios y las entradas numéricas incompletas siguen siendo inválidos.
Los libros de set up y los demás campos mantienen sus validaciones.

## Ancho común del grupo — 4.19.0

Para nuevos registros, el ancho se elige junto al gramaje y se aplica a todas
las bobinas, incluidas las que se agreguen después. El catálogo inicia con
480, 640 y 660 mm; permite añadir anchos positivos, sin duplicados y ordenados
numéricamente. Los anchos añadidos se guardan en este navegador.
Cambiar el ancho recalcula kg y tara proporcional sin redondear los valores internos.
Los pendientes antiguos con varios anchos se recuperan sin modificar sus bobinas;
solo se unifican si el operador selecciona expresamente un ancho común.
