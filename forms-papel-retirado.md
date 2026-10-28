# Motivos y áreas del papel retirado

La calculadora v4.9 permite seleccionar motivos y varias áreas por bobina.
El apartado se abre cuando se escribe un peso positivo de papel retirado.
Los catálogos se guardan en el navegador del equipo. Las selecciones del
trabajo aparecen en su impresión.

## Conectar con el mismo Microsoft Forms

Agregar estas dos preguntas al formulario existente:

| Pregunta | Tipo | Configuración |
| --- | --- | --- |
| Motivos del papel retirado | Texto | Respuesta larga, opcional |
| Áreas involucradas del papel retirado | Texto | Respuesta larga, opcional |

Se usan preguntas de texto porque la calculadora puede enviar varios motivos,
varias áreas y varias bobinas en una sola respuesta de grupo. Se mantienen
opcionales porque un trabajo puede no tener papel retirado.

Cada texto conservará bobina y kg. Ejemplo:

- Motivos: `Bobina 1 (12 kg): Lonjas dañadas | Bobina 2 (3 kg): Ajuste inicial`
- Áreas: `Bobina 1 (12 kg): Almacén | Bobina 2 (3 kg): Planta digital; Mantenimiento`

Generar un vínculo de respuestas predefinidas con `MOTIVO_PRUEBA` y
`AREA_PRUEBA` en las dos nuevas preguntas. No enviar una respuesta de prueba.
Obtener los identificadores de las preguntas de ese vínculo y colocarlos en
`WITHDRAWAL_FORM_KEYS.reasons` y `WITHDRAWAL_FORM_KEYS.areas` en index.html.

Hasta completar ambos identificadores, la calculadora no envía esos dos datos
a Forms y muestra el aviso correspondiente. El envío existente conserva sus
campos, sus límites de longitud y el paquete CIMAGRAF_OPS_V2 sin cambios.

Forms expone cada pregunta como una columna en su Excel de respuestas.
Si otro libro se alimenta mediante Power Automate, también se deben mapear las
dos columnas en ese flujo. Las respuestas históricas no se rellenan solas.

Las áreas identifican participación; no asignan responsabilidad automáticamente.
Los motivos y las áreas describen solo el papel retirado. El sobrante del tuco
mantiene su cálculo de papel neto y no requiere estos motivos.
