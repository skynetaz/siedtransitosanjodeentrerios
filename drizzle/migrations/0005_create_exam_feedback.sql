CREATE TABLE public.exam_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL UNIQUE REFERENCES public.exams(id) ON DELETE CASCADE,
  aspirante_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  facilidad integer NOT NULL,
  comodidad text NOT NULL,
  etiquetas text[] NOT NULL DEFAULT ARRAY[]::text[],
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_feedback_facilidad_rango CHECK (facilidad BETWEEN 1 AND 5),
  CONSTRAINT exam_feedback_comodidad_valida CHECK (comodidad IN ('comodo','normal','incomodo'))
);

CREATE INDEX exam_feedback_created_idx ON public.exam_feedback (created_at DESC);

GRANT SELECT, INSERT ON public.exam_feedback TO authenticated;
GRANT ALL ON public.exam_feedback TO service_role;

ALTER TABLE public.exam_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback insert own" ON public.exam_feedback
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.aspirante_id = auth.uid()));

CREATE POLICY "feedback read own" ON public.exam_feedback
  FOR SELECT TO authenticated
  USING (aspirante_id = auth.uid());

CREATE POLICY "feedback read staff" ON public.exam_feedback
  FOR SELECT TO authenticated
  USING (public.current_role_any(ARRAY['admin'::public.app_role,'inspector'::public.app_role]));
