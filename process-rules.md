# Reglas de proceso — 4.15.0

Confirmadas por el usuario el 4 de noviembre de 2026. Los parámetros son por OP:

- Copias de set up: entero >= 0 (valor inicial 0).
- Copias de corrida: entero > 0; conserva el campo interno `copies` de Forms/Excel.
- Calibración: checkbox independiente, desmarcado inicialmente.
- Paradas: entero >= 0 (valor inicial 0).

Metros por OP:

- Producción = libros × copias de corrida × avance en mm / 1000.
- Set up = copias de set up × 20.
- Calibración = copias de set up × 6, únicamente si se marca calibración.
- Paradas = cantidad de paradas × (copias de corrida × avance en mm / 1000 + 20).
- Empalmes del grupo = 20 × máximo(cantidad de OP, cantidad de bobinas registradas).

Cada OP recibe una unidad de empalme de 20 m. Si hay más bobinas que OP,
las unidades restantes se asignan a la última OP; este criterio aparece en
el desglose y en la impresión para que los totales por OP sean verificables.
Agregar una bobina registrada aumenta la base de empalmes cuando supera
la cantidad de OP, aunque su saldo completo no sume a la devolución si no se utiliza.

La asignación secuencial se realiza en este orden por OP: set up, calibración,
empalmes, producción y paradas. El consumo de cada etapa usa el ancho real
y el gramaje de la bobina de la que se toma el papel. Una etapa puede cruzar
varias bobinas y no se avanza a la siguiente mientras quede material disponible.

Los kg de producción útil y de proceso se conservan por separado. El saldo es:
inicial − lonjas − sobrante neto de papel − producción − proceso.
Los kg de cartón siguen excluidos según las taras ya configuradas.
El amarillo del gráfico suma lonjas + sobrante neto + proceso; el azul muestra
solo producción. La impresión y el PDF comparten las tablas ampliadas.

## Ejemplo de control

100 libros, 30 copias de corrida, avance 240 mm, 10 copias de set up,
calibración marcada, 2 paradas y una bobina:

720 + 200 + 60 + 54,4 + 20 = 1054,4 m.
Con ancho 1000 mm, gramaje 100 g/m² y 200 kg iniciales, sin lonjas ni sobrante:
consumo 105,44 kg; devolución 94,56 kg.

## Forms y compatibilidad

Se conservan las preguntas existentes y las primeras nueve columnas del
paquete `CIMAGRAF_OPS_V2`. Metros y kg por OP incluyen todos los consumos.
Se añaden diez columnas al final de cada OP:
copias de set up, calibración (0/1), paradas, metros de producción,
metros de set up, metros de calibración, metros de paradas, metros de empalmes,
kg de producción y kg de proceso. Las preguntas de lonjas/sobrante conservan
exclusivamente los pesos que introduce el operario.

No se cambian preguntas ni respuestas de Microsoft Forms ni archivos Excel.
Las instantáneas de PDF anteriores siguen siendo imprimibles con sus valores originales.

## Comprobaciones

`tests/process.test.cjs` cubre fórmulas, condiciones, reglas de empalme,
anchos distintos, material insuficiente, saldo cero, taras y detalle de Forms.
Los escenarios históricos de `tests/calculation.test.cjs` fijan el metraje total,
incluido el empalme, para verificar la asignación y el balance de masa ya existentes;
las pruebas nuevas verifican cada componente del metraje de producción.
