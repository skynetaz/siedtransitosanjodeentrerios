ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS questions_clase_orden_idx ON public.questions (clase, orden);