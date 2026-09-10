# Editar las preguntas de cada categoría de examen

## Qué se logra

En **Categorías de examen**, cada categoría pasa a tener su propia lista de preguntas elegida a mano. Desde la vista previa se pueden quitar preguntas, agregar otras desde el banco de preguntas, reordenarlas y guardar. Lo que se edite en una categoría **no afecta a ninguna otra**: cada categoría guarda su propia selección.

Esto resuelve el problema de preguntas que se repetían entre exámenes: hoy cada examen se arma al azar del mismo montón de preguntas de la clase; con la selección propia, usted decide exactamente qué entra en cada categoría.

## Cómo queda la pantalla

En cada categoría, el botón **Vista previa** se convierte en **Vista previa y edición**, con:

- La lista de preguntas de esa categoría, numeradas, con su clase, tema, si es eliminatoria y las cuatro opciones (la correcta resaltada).
- Botón **Quitar** en cada pregunta y flechas para subir/bajar el orden.
- Botón **Agregar del banco de preguntas**: abre un buscador con todas las preguntas (filtro por clase, por tema, por texto y "solo señales"), con casillas para marcar varias y agregarlas de una vez. Las ya incluidas aparecen marcadas y no se duplican.
- Resumen arriba: cantidad de preguntas, cuántas son de señales, eliminatorias y puntaje total, más un aviso si la cantidad no coincide con el total configurado.
- **Guardar selección** y **Cancelar**. Mientras no haya cambios guardados, nada se modifica.
- Un modo **Automático**: si la categoría no tiene selección propia, sigue armando el examen al azar como hasta ahora (comportamiento actual intacto para las categorías que no toque).

Al guardar se muestra un resumen de los cambios (agregadas / quitadas / reordenadas) antes de confirmar, igual que en Configuración.

## Cómo se arma el examen después

Cuando un aspirante rinde una categoría con selección propia, el examen usa exactamente esas preguntas, en ese orden, con las opciones mezcladas dentro de cada pregunta. Si la categoría no tiene selección propia, se mantiene el armado automático actual.

## Detalles técnicos

- **Nueva tabla** `public.exam_category_questions`: `categoria_slug` (FK a `exam_categories.slug`, ON DELETE CASCADE), `question_id` (FK a `questions.id`, ON DELETE CASCADE), `orden int`, PK compuesta (`categoria_slug`, `question_id`). GRANTs: `SELECT` a `authenticated`, `ALL` a `service_role`; RLS activada con lectura para autenticados y escritura solo `has_role(auth.uid(),'admin')`. Al ser una tabla propia, editar una categoría nunca toca filas de otra ni la tabla global `questions`.
- **`src/lib/categorias.functions.ts`**: nuevas server functions `listarPreguntasCategoria(slug)`, `guardarPreguntasCategoria({ slug, ids[] })` (reemplaza la selección de esa categoría en una sola operación, validando admin) y `listarBancoPreguntas({ clases?, topicId?, texto? })` para el buscador. `previsualizarCategoria` pasa a aceptar una lista de ids explícita y devolver esas preguntas en orden, cayendo al armado aleatorio cuando no hay selección.
- **`src/lib/seleccion.server.ts`**: `seleccionarPreguntas` primero consulta `exam_category_questions` por `cat.slug`; si hay filas, usa esas preguntas en su `orden` (respetando `activa`) y solo mezcla las opciones; si no hay, conserva la lógica aleatoria actual con el cupo de señales.
- **`src/routes/admin.categorias.tsx`**: la vista previa pasa a ser editable (estado local de ids, quitar/reordenar/agregar), con el diálogo del banco de preguntas y la confirmación de cambios antes de guardar.
- Sin cambios en el flujo del aspirante, firmas, archivo ni impresión.

## Verificación antes de entregar

1. Chequeo de tipos del proyecto.
2. Prueba real en el navegador: editar una categoría (quitar y agregar preguntas del banco), guardar, reabrir y confirmar que se mantiene; abrir una segunda categoría y confirmar que su lista quedó intacta.
3. Prueba de punta a punta: generar un código de esa categoría, rendir el examen y verificar que aparecen exactamente las preguntas elegidas, en orden, sin preguntas de otras clases.
4. Borrado de todos los datos temporales de prueba.
