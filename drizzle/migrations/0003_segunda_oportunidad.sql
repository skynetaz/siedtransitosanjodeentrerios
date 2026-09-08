ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS segunda_oportunidad boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS respuesta_previa text;

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS segunda_oportunidad_usada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS segunda_oportunidad_question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL;