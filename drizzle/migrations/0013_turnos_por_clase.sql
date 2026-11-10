ALTER TABLE public.turnos_practicos DROP CONSTRAINT IF EXISTS turnos_practicos_exam_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS turnos_examen_clase_unico ON public.turnos_practicos (exam_id, coalesce(clase, ''));
DROP INDEX IF EXISTS public.turnos_activos_unicos;
CREATE UNIQUE INDEX turnos_activos_unicos ON public.turnos_practicos (aspirante_id, categoria_slug, coalesce(clase, '')) WHERE estado IN ('asignado','pendiente','reprogramado');