CREATE TABLE public.exam_category_questions (
  categoria_slug text NOT NULL REFERENCES public.exam_categories(slug) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (categoria_slug, question_id)
);

CREATE INDEX idx_ecq_categoria_orden ON public.exam_category_questions (categoria_slug, orden);

GRANT SELECT ON public.exam_category_questions TO authenticated;
GRANT ALL ON public.exam_category_questions TO service_role;

ALTER TABLE public.exam_category_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecq read auth" ON public.exam_category_questions
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "ecq admin manage" ON public.exam_category_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));