# Mostrar la categoría real del examen rendido

## Qué está pasando (verificado en los datos)

El examen que rinde la persona **sí es el correcto**: las preguntas se arman siempre a partir de la categoría elegida al generar el código (por ejemplo "Principiante — Moto y Auto (A+B)" o "Anexo / Caduco — Auto (B)"), no de una clase suelta.

El problema es sólo de **cartel**: al guardar el examen se anota además una única letra de clase, y esa letra es la primera de la categoría. Los datos reales lo confirman:

| Categoría usada | Se muestra hoy |
|---|---|
| Principiante — Moto y Auto (A+B) — 9 exámenes | Clase A |
| Principiante — Moto (A) — 6 | Clase A |
| Anexo / Caduco — Auto (B) — 4 | Clase B |
| Anexo / Caduco — Moto (A) — 3 | Clase A |
| Principiante — Auto (B) — 3 | Clase B |
| Anexo / Caduco — Moto y Auto (A+B) — 2 | Clase A |

Por eso todo lo que era A+B, o principiante A, o anexo A, aparece como "Clase A" y no se distingue si fue principiante o caduco.

## Qué se va a hacer

1. En la pantalla final del aspirante, debajo de sus datos, mostrar el nombre completo de la categoría rendida (ej. "Anexo / Caduco — Moto y Auto (A+B)"), no una letra.
2. Lo mismo en Archivo: en la lista de exámenes, en la ficha de cada examen, en la impresión y en las exportaciones a PDF y Excel.
3. Cuando el examen sea de una categoría con varias clases, aclarar las clases incluidas junto al nombre (ej. "clases A + B").
4. Para los exámenes viejos que no tengan la categoría guardada, mostrar la clase como hasta ahora, para que nunca quede un campo vacío.
5. Verificar de punta a punta: generar códigos de tres categorías distintas (principiante A+B, anexo B, profesional D), rendir, y comprobar que el examen final y el impreso digan exactamente la categoría elegida y que las preguntas correspondan a esas clases.

## Detalle técnico

- Los exámenes ya guardan `categoria_slug` y `clases_incluidas`; la selección de preguntas (`src/lib/seleccion.server.ts`) resuelve la categoría por slug, así que el contenido ya es correcto. No hace falta migración de esquema.
- `src/lib/archivo.functions.ts`: incluir `categoria_slug` y `clases_incluidas` en el listado, y resolver `exam_categories.nombre` para el detalle y el listado.
- `src/routes/admin.archivo.tsx`: reemplazar el badge `Clase {e.clase}` y la línea de impresión por el nombre de la categoría, con la clase como respaldo.
- `src/lib/export-utils.ts`: usar el nombre de categoría en el PDF y en la columna de Excel.
- `src/routes/examen.tsx`: mostrar la categoría del `config_snapshot` (ya guarda `categoria` y `nombre`) en la pantalla de resultado, junto a los datos del aspirante.
- Auditoría con recorrido real en el navegador sobre tres categorías, y limpieza de los datos de prueba al terminar.
