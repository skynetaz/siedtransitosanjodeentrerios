-- 1. Preguntas: opciones incorrectas para multiple choice
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS opciones_incorrectas text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS opciones_revisadas boolean NOT NULL DEFAULT false;

-- 2. Códigos de examen
ALTER TABLE public.exam_access_codes
  ADD COLUMN IF NOT EXISTS dni text,
  ADD COLUMN IF NOT EXISTS exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.exam_access_codes ALTER COLUMN status SET DEFAULT 'disponible';
ALTER TABLE public.exam_access_codes ALTER COLUMN inspector_id DROP NOT NULL;
UPDATE public.exam_access_codes SET status = 'disponible' WHERE status = 'habilitado';

CREATE UNIQUE INDEX IF NOT EXISTS exam_access_codes_codigo_key ON public.exam_access_codes (codigo);

-- 3. Exámenes: metadatos de registro
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS codigo_utilizado text,
  ADD COLUMN IF NOT EXISTS motivo_finalizacion text,
  ADD COLUMN IF NOT EXISTS tiempo_utilizado_seg integer,
  ADD COLUMN IF NOT EXISTS porcentaje numeric;

-- 4. Eventos de seguridad del examen
CREATE TABLE IF NOT EXISTS public.exam_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  motivo text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.exam_events TO authenticated;
GRANT ALL ON public.exam_events TO service_role;

ALTER TABLE public.exam_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_events read staff" ON public.exam_events
  FOR SELECT TO authenticated
  USING (public.current_role_any(ARRAY['admin'::app_role, 'inspector'::app_role]));

CREATE POLICY "exam_events read own" ON public.exam_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.aspirante_id = auth.uid()));

CREATE POLICY "exam_events insert own" ON public.exam_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.aspirante_id = auth.uid()));

CREATE INDEX IF NOT EXISTS exam_events_exam_id_idx ON public.exam_events (exam_id);