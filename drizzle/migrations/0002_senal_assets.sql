CREATE TABLE public.senal_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  url text NOT NULL,
  nombre text NOT NULL DEFAULT '',
  content_type text,
  size integer,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.senal_assets TO anon;
GRANT SELECT, INSERT, DELETE ON public.senal_assets TO authenticated;
GRANT ALL ON public.senal_assets TO service_role;

ALTER TABLE public.senal_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "senal_assets read all" ON public.senal_assets FOR SELECT USING (true);
CREATE POLICY "senal_assets staff insert" ON public.senal_assets FOR INSERT TO authenticated
  WITH CHECK (public.current_role_any(ARRAY['admin'::app_role,'inspector'::app_role]));
CREATE POLICY "senal_assets staff delete" ON public.senal_assets FOR DELETE TO authenticated
  USING (public.current_role_any(ARRAY['admin'::app_role,'inspector'::app_role]));

CREATE POLICY "senales bucket staff read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'senales' AND public.current_role_any(ARRAY['admin'::app_role,'inspector'::app_role]));
CREATE POLICY "senales bucket staff insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'senales' AND public.current_role_any(ARRAY['admin'::app_role,'inspector'::app_role]));
CREATE POLICY "senales bucket staff delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'senales' AND public.current_role_any(ARRAY['admin'::app_role,'inspector'::app_role]));