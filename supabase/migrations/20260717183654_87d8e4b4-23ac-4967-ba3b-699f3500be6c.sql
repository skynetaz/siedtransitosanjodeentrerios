
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS is_emulation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_aspirante text,
  ADD COLUMN IF NOT EXISTS signature_inspector text,
  ADD COLUMN IF NOT EXISTS signed_aspirante_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_inspector_at timestamptz,
  ADD COLUMN IF NOT EXISTS datos_aspirante jsonb;

CREATE INDEX IF NOT EXISTS exams_is_emulation_idx ON public.exams (is_emulation);
CREATE INDEX IF NOT EXISTS exams_status_idx ON public.exams (status);
