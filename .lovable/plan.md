# Cargar señales propias en alta calidad

## Objetivo
En Admin → Señales de tránsito por clase, poder subir imágenes nuevas (cualquier formato de imagen: JPG, PNG, WEBP, SVG), verlas antes de guardar, usarlas para reemplazar las señales existentes y borrar del catálogo las que ya no sirvan.

## Qué va a ver el usuario

1. **Botón "Subir imagen"** dentro de cada selector de imagen (imagen correcta y cada distractor) y también en la cabecera de la pantalla de Señales.
   - Se elige el archivo desde el celular o la computadora (cámara/galería en móvil).
   - Aparece una **vista previa grande** con el nombre del archivo y el peso.
   - Botones: "Usar esta imagen" (queda seleccionada en esa opción y se guarda en el catálogo) o "Cancelar".
   - Aviso si el archivo no es una imagen o supera 5 MB.

2. **Reemplazar una señal existente**: en cada señal de la lista, el botón "Editar" ya abre el selector; ahí, sobre la imagen actual, se agrega "Reemplazar imagen" que abre la misma carga con vista previa. Al guardar, la señal queda con la imagen nueva.

3. **Eliminar imagen del catálogo**: en la grilla del selector, cada miniatura subida por el administrador tiene un botón de papelera. Usa la doble confirmación con el cartel de PELIGRO que ya existe. Las imágenes originales del sistema no se borran (solo se pueden dejar de usar), para no romper exámenes ya guardados.
   - Si una imagen está en uso por alguna señal, se avisa en el segundo cartel cuántas señales la usan.

4. Las imágenes subidas se muestran igual que las actuales en examen, emulador, vista previa, archivo, impresión y PDF, en su calidad original.

## Detalles técnicos

- Nuevo bucket público de almacenamiento `senales` (límite 5 MB por archivo), con políticas: lectura pública; escritura/borrado solo para admin/inspector (`current_role_any`).
- Nueva tabla `public.senal_assets` (id, path, url, nombre, content_type, size, created_by, created_at) con GRANTs: SELECT a `anon` y `authenticated`, INSERT/DELETE a `authenticated` con rol admin/inspector, ALL a `service_role`. Sirve como catálogo editable junto al listado estático actual.
- `esSenal()` en `src/components/exam/ExamPieces.tsx` pasa a reconocer también las URL del bucket, no solo las rutas `/senales/`.
- `ImagePicker` en `src/routes/admin.senales.tsx` se extiende con: subida (`supabase.storage.from('senales').upload`), vista previa previa al guardado, borrado con `ConfirmarBorrado`, y la grilla combina catálogo estático + subidas.
- La exportación a PDF e impresión ya convierten las imágenes a data URL; se ajusta la carga para admitir URL remotas del bucket.

## Fuera de alcance
- No se recorta ni edita la imagen dentro de la app (se sube tal cual).
- No se borran las imágenes originales del sistema.
