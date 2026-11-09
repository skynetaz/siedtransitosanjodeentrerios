CREATE TABLE public.institucion_miembros (
  user_id uuid PRIMARY KEY,
  institucion_id uuid NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.institucion_miembros TO authenticated;
GRANT ALL ON public.institucion_miembros TO service_role;
ALTER TABLE public.institucion_miembros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "miembro lee propio" ON public.institucion_miembros FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_owner(auth.uid()));

CREATE OR REPLACE FUNCTION public.institucion_de(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE(
  (SELECT institucion_id FROM public.institucion_miembros WHERE user_id = _uid),
  (SELECT id FROM public.instituciones WHERE es_principal LIMIT 1)) $$;

CREATE OR REPLACE FUNCTION public.current_institucion()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.institucion_de(auth.uid()) $$;

ALTER TABLE public.questions ADD COLUMN institucion_id uuid DEFAULT public.current_institucion();
ALTER TABLE public.exam_categories ADD COLUMN institucion_id uuid DEFAULT public.current_institucion();
ALTER TABLE public.exams ADD COLUMN institucion_id uuid DEFAULT public.current_institucion();
ALTER TABLE public.exam_access_codes ADD COLUMN institucion_id uuid DEFAULT public.current_institucion();

UPDATE public.questions SET institucion_id = (SELECT id FROM public.instituciones WHERE es_principal LIMIT 1) WHERE institucion_id IS NULL;
UPDATE public.exam_categories SET institucion_id = (SELECT id FROM public.instituciones WHERE es_principal LIMIT 1) WHERE institucion_id IS NULL;
UPDATE public.exams SET institucion_id = (SELECT id FROM public.instituciones WHERE es_principal LIMIT 1) WHERE institucion_id IS NULL;
UPDATE public.exam_access_codes SET institucion_id = (SELECT id FROM public.instituciones WHERE es_principal LIMIT 1) WHERE institucion_id IS NULL;

CREATE INDEX questions_inst_idx ON public.questions(institucion_id);
CREATE INDEX exams_inst_idx ON public.exams(institucion_id);
CREATE INDEX codes_inst_idx ON public.exam_access_codes(institucion_id);
CREATE INDEX cats_inst_idx ON public.exam_categories(institucion_id);

CREATE POLICY "aislamiento institucion" ON public.questions AS RESTRICTIVE FOR ALL TO authenticated
  USING (institucion_id = public.current_institucion()) WITH CHECK (institucion_id = public.current_institucion());
CREATE POLICY "aislamiento institucion" ON public.exam_categories AS RESTRICTIVE FOR ALL TO authenticated
  USING (institucion_id = public.current_institucion()) WITH CHECK (institucion_id = public.current_institucion());
CREATE POLICY "aislamiento institucion" ON public.exams AS RESTRICTIVE FOR ALL TO authenticated
  USING (institucion_id = public.current_institucion() OR aspirante_id = auth.uid())
  WITH CHECK (institucion_id = public.current_institucion() OR aspirante_id = auth.uid());
CREATE POLICY "aislamiento institucion" ON public.exam_access_codes AS RESTRICTIVE FOR ALL TO authenticated
  USING (institucion_id = public.current_institucion() OR aspirante_id = auth.uid())
  WITH CHECK (institucion_id = public.current_institucion() OR aspirante_id = auth.uid());

CREATE POLICY "inst staff read propia" ON public.instituciones FOR SELECT TO authenticated
  USING (id = public.current_institucion() AND public.current_role_any(ARRAY['admin'::app_role,'inspector'::app_role]));