CREATE TABLE public.platform_owners (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_owners TO authenticated;
GRANT ALL ON public.platform_owners TO service_role;
ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read self" ON public.platform_owners FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_platform_owner(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = _uid) $$;

CREATE TABLE public.instituciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  localidad text,
  contacto_nombre text,
  contacto_email text,
  contacto_telefono text,
  logo_url text,
  plan text NOT NULL DEFAULT 'basico',
  estado text NOT NULL DEFAULT 'demo',
  es_principal boolean NOT NULL DEFAULT false,
  demo_vence timestamptz,
  precio_mensual numeric,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instituciones TO authenticated;
GRANT ALL ON public.instituciones TO service_role;
ALTER TABLE public.instituciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inst owner manage" ON public.instituciones FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid())) WITH CHECK (public.is_platform_owner(auth.uid()));
CREATE POLICY "inst staff read principal" ON public.instituciones FOR SELECT TO authenticated
  USING (es_principal AND public.current_role_any(ARRAY['admin'::app_role,'inspector'::app_role]));
CREATE UNIQUE INDEX instituciones_una_principal ON public.instituciones (es_principal) WHERE es_principal;
CREATE TRIGGER instituciones_touch BEFORE UPDATE ON public.instituciones FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.platform_owners (user_id) VALUES ('8c1a0515-e888-4dbc-8981-8b0b609a1da0') ON CONFLICT DO NOTHING;
INSERT INTO public.instituciones (nombre, localidad, plan, estado, es_principal, features)
VALUES ('Dirección de Tránsito y Transporte', 'San José, Entre Ríos', 'enterprise', 'activa', true,
  '{"encuestas":true,"estadisticas":true,"emulador":true,"importador":true,"ia":true,"senales_hd":true,"actas_personalizadas":true}'::jsonb);