CREATE TABLE public.exam_categories (
  slug text PRIMARY KEY,
  nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'principiante',
  grupo text NOT NULL DEFAULT 'particular',
  clases text[] NOT NULL DEFAULT ARRAY[]::text[],
  incluye_senales boolean NOT NULL DEFAULT true,
  preguntas_senales integer NOT NULL DEFAULT 5,
  cantidad_preguntas integer NOT NULL DEFAULT 20,
  duracion_minutos integer NOT NULL DEFAULT 15,
  max_errores integer NOT NULL DEFAULT 4,
  activa boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exam_categories TO authenticated;
GRANT ALL ON public.exam_categories TO service_role;

ALTER TABLE public.exam_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories read auth" ON public.exam_categories
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "categories admin manage" ON public.exam_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_exam_categories_touch BEFORE UPDATE ON public.exam_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS categoria_slug text;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS clases_incluidas text[];
ALTER TABLE public.exam_access_codes ADD COLUMN IF NOT EXISTS categoria_slug text;
ALTER TABLE public.exam_access_codes ADD COLUMN IF NOT EXISTS clases_incluidas text[];

INSERT INTO public.exam_categories (slug, nombre, tipo, grupo, clases, incluye_senales, preguntas_senales, cantidad_preguntas, duracion_minutos, max_errores, orden) VALUES
  ('prin-a',       'Principiante — Moto (A)',            'principiante', 'particular', ARRAY['UNICA','A'],     true, 5, 20, 15, 4, 10),
  ('prin-b',       'Principiante — Auto (B)',            'principiante', 'particular', ARRAY['UNICA','B'],     true, 5, 20, 15, 4, 20),
  ('prin-ab',      'Principiante — Moto y Auto (A+B)',   'principiante', 'particular', ARRAY['UNICA','A','B'], true, 6, 25, 20, 5, 30),
  ('anexo-a',      'Anexo / Caduco — Moto (A)',          'anexo_caduco', 'particular', ARRAY['A'],             true, 5, 15, 12, 3, 40),
  ('anexo-b',      'Anexo / Caduco — Auto (B)',          'anexo_caduco', 'particular', ARRAY['B'],             true, 5, 15, 12, 3, 50),
  ('anexo-ab',     'Anexo / Caduco — Moto y Auto (A+B)', 'anexo_caduco', 'particular', ARRAY['A','B'],         true, 5, 20, 15, 4, 60),
  ('prof-prin-c',  'Profesional principiante — Clase C', 'principiante', 'profesional', ARRAY['UNICA','C'],    true, 5, 25, 20, 5, 70),
  ('prof-prin-d',  'Profesional principiante — Clase D', 'principiante', 'profesional', ARRAY['UNICA','D'],    true, 5, 25, 20, 5, 80),
  ('prof-prin-e',  'Profesional principiante — Clase E', 'principiante', 'profesional', ARRAY['UNICA','E'],    true, 5, 25, 20, 5, 90),
  ('prof-anexo-c', 'Profesional anexo / caduco — Clase C','anexo_caduco','profesional', ARRAY['C'],            true, 5, 20, 15, 4, 100),
  ('prof-anexo-d', 'Profesional anexo / caduco — Clase D','anexo_caduco','profesional', ARRAY['D'],            true, 5, 20, 15, 4, 110),
  ('prof-anexo-e', 'Profesional anexo / caduco — Clase E','anexo_caduco','profesional', ARRAY['E'],            true, 5, 20, 15, 4, 120);