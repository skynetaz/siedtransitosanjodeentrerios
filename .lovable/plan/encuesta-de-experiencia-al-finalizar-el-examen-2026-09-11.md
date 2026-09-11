# Encuesta de experiencia al finalizar el examen

Al terminar el examen (aprobado, desaprobado o cancelado), el aspirante ve una encuesta corta y moderna. Todas las opiniones quedan registradas en una nueva sección del panel de administración.

## Qué verá el aspirante

Después de firmar, aparece una tarjeta animada con tres pasos muy breves (una pregunta por pantalla, botones grandes, pensado para el celular):

1. **¿Qué tan fácil te resultó usar la app?** — cinco caritas / estrellas (1 a 5).
2. **¿Te resultó cómodo rendir así?** — tres opciones: Muy cómodo / Normal / Incómodo.
3. **¿Querés dejarnos un comentario?** — texto libre y opcional (máx. 500 caracteres), más chips rápidos para elegir sin escribir ("Todo claro", "Letra chica", "Se trabó", "Faltó tiempo", "Difícil de entender").

Cierra con una pantalla de agradecimiento. La encuesta es **opcional**: hay un "Omitir" visible y salir sigue estando permitido una vez firmado. La barra de progreso y las transiciones dan la sensación de encuesta moderna, sin agregar pasos obligatorios.

Participan todos: cualquier persona que rinda, apruebe o no, incluso si el examen se canceló.

## Qué verá el administrador

Nueva pestaña **Opiniones** en el panel:

- Tarjetas de resumen: promedio de facilidad, promedio de comodidad, total de respuestas, y porcentaje positivo / neutro / negativo.
- Barras de distribución de 1 a 5 estrellas.
- Ranking de los motivos rápidos más elegidos.
- Lista de comentarios con filtro por sentimiento (positivos / neutros / negativos), fecha, categoría de examen rendido y resultado (aprobado / desaprobado), con buscador de texto.
- Exportar a Excel, igual que las otras secciones.

El sentimiento se calcula de forma simple y transparente: 4-5 estrellas = positivo, 3 = neutro, 1-2 = negativo.

## Detalles técnicos

- Nueva tabla `public.exam_feedback`: `id`, `exam_id` (FK a `exams`, único), `aspirante_id`, `facilidad` (1-5), `comodidad` ('comodo' | 'normal' | 'incomodo'), `etiquetas` (text[]), `comentario` (text), `created_at`. GRANTs para `authenticated` y `service_role`, RLS activa: el aspirante solo puede insertar feedback de su propio examen finalizado; admin e inspector pueden leer todo.
- Server functions en `src/lib/feedback.functions.ts`:
  - `enviarFeedback` (con `requireSupabaseAuth`): valida con Zod, verifica que el examen pertenece al usuario y está finalizado, e inserta una sola vez por examen.
  - `listarFeedback` y `resumenFeedback` (solo admin/inspector): devuelven comentarios con datos del examen (categoría, resultado, fecha) y las métricas agregadas.
- Nuevo componente `src/components/EncuestaFinal.tsx` con los tres pasos y animaciones CSS existentes; se monta en `src/routes/examen.tsx` dentro de la pantalla `Resultado`, después del bloque de firma.
- Nueva ruta `src/routes/admin.opiniones.tsx` más la pestaña "Opiniones" en `src/routes/admin.tsx`; exportación reutilizando `src/lib/export-utils.ts`.
- Sin cambios en el motor del examen, la corrección, las firmas ni las categorías.

## Verificación

- Prueba real de punta a punta con navegador: generar código, rendir un examen, firmar, completar la encuesta, y comprobar que aparece en la sección Opiniones con el promedio correcto; también probar el caso "Omitir" y el intento de enviar dos veces.
- Chequeo de tipos y de consola sin errores, y borrado de todos los datos temporales de prueba al finalizar.
