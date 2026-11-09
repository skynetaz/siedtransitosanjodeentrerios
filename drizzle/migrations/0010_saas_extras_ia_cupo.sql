ALTER TABLE public.instituciones ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE public.instituciones ADD COLUMN IF NOT EXISTS contacto_telefono text;
ALTER TABLE public.instituciones ADD COLUMN IF NOT EXISTS ia_cupo_mensual integer;
CREATE TABLE IF NOT EXISTS public.ia_uso (
  institucion_id uuid NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  periodo text NOT NULL,
  usos integer NOT NULL DEFAULT 0,
  PRIMARY KEY (institucion_id, periodo)
);
GRANT SELECT ON public.ia_uso TO authenticated;
GRANT ALL ON public.ia_uso TO service_role;
ALTER TABLE public.ia_uso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_uso lectura propia u owner" ON public.ia_uso FOR SELECT TO authenticated
USING (public.is_platform_owner(auth.uid()) OR institucion_id = public.current_institucion());
CREATE TABLE IF NOT EXISTS public.plataforma_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  precios jsonb NOT NULL DEFAULT '{"basico":45000,"profesional":95000,"enterprise":180000}'::jsonb,
  telefonos text[] NOT NULL DEFAULT '{}',
  email_contacto text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.plataforma_config (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT ON public.plataforma_config TO anon, authenticated;
GRANT UPDATE ON public.plataforma_config TO authenticated;
GRANT ALL ON public.plataforma_config TO service_role;
ALTER TABLE public.plataforma_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config lectura" ON public.plataforma_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "config edita owner" ON public.plataforma_config FOR UPDATE TO authenticated
USING (public.is_platform_owner(auth.uid())) WITH CHECK (public.is_platform_owner(auth.uid()));
CREATE OR REPLACE FUNCTION public.institucion_publica(_slug text)
RETURNS TABLE(id uuid, nombre text, localidad text, logo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, nombre, localidad, logo_url FROM public.instituciones WHERE slug = lower(_slug) AND estado <> 'suspendida' LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.institucion_publica(text) TO anon, authenticated;