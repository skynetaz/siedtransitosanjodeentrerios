DROP POLICY IF EXISTS "config lectura" ON public.plataforma_config;
CREATE POLICY "config lectura" ON public.plataforma_config FOR SELECT TO authenticated USING (public.is_platform_owner(auth.uid()));
REVOKE SELECT ON public.plataforma_config FROM anon;