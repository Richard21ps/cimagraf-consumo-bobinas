# Reglas de proceso — 4.15.1

Corrección confirmada por el usuario el 4 de noviembre de 2026. Los parámetros son por OP:

- Libros de set up: entero >= 0 (valor inicial 0).
- Libros de corrida: entero > 0; conserva el campo interno `books` de Forms/Excel.
- Copias por libro: una sola cantidad común para set up y corrida (`copies`).
- Calibración: checkbox independiente, desmarcado inicialmente.
- Paradas: entero >= 0 (valor inicial 0).

Metros por OP:

- Corrida = libros de corrida × copias por libro × avance en mm / 1000.
- Set up = libros de set up × (copias por libro × avance en mm / 1000 + 20).
- Calibración = 16 m por OP si está marcada, de lo contrario 0 m. Es independiente de los libros de set up.
- Paradas = cantidad de paradas × (copias por libro × avance en mm / 1000 + 20).
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

## Ejemplo de control

100 libros de corrida, 10 libros de set up, 30 copias por libro, avance 240 mm,
calibración marcada, 2 paradas y una bobina:

- Corrida: 100 × 30 × 240 / 1000 = 720 m.
- Set up: 10 × (30 × 240 / 1000 + 20) = 272 m.
- Calibración: 16 m.
- Paradas: 2 × (30 × 240 / 1000 + 20) = 54,4 m.
- Empalme: 20 m.

Total: 1082,4 m. Con ancho 1000 mm, gramaje 100 g/m² y 200 kg iniciales,
sin lonjas ni sobrante: consumo 108,24 kg y devolución 91,76 kg.

## Forms y compatibilidad

Se conservan las preguntas existentes y las primeras nueve columnas del
paquete `CIMAGRAF_OPS_V2`. Metros y kg por OP incluyen todos los consumos.
Las columnas adicionales, desde la décima, contienen:
libros de set up, calibración (0/1), paradas, metros de corrida,
metros de set up, metros de calibración, metros de paradas, metros de empalmes,
kg de corrida, kg de proceso y versión de las reglas (2).
Las preguntas de lonjas/sobrante conservan exclusivamente los pesos introducidos.

No se cambian preguntas ni respuestas de Microsoft Forms ni archivos Excel.
Los PDF anteriores se imprimen con sus parámetros y valores originales.
Al volver a editar un registro de la versión 4.15.0, los libros de set up
quedan pendientes de completar: no se convierten las antiguas copias a libros.
Un registro corregido con reglas nuevas no reutiliza un PDF con reglas anteriores.

## Comprobaciones

`tests/process.test.cjs` cubre fórmulas, calibración sin set up, copias comunes,
reglas de empalme, anchos distintos, material insuficiente, saldo cero, taras
y detalle de Forms. Los escenarios históricos de `tests/calculation.test.cjs`
fijan el metraje total incluido el empalme para verificar asignación y masa;
las pruebas nuevas verifican cada componente del metraje.
