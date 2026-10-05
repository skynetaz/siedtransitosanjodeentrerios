DROP POLICY IF EXISTS "topics read all auth" ON public.topics;
CREATE POLICY "topics read staff" ON public.topics FOR SELECT TO authenticated
  USING (public.current_role_any(ARRAY['admin'::app_role, 'inspector'::app_role]));

DROP POLICY IF EXISTS "categories read auth" ON public.exam_categories;
CREATE POLICY "categories read staff" ON public.exam_categories FOR SELECT TO authenticated
  USING (public.current_role_any(ARRAY['admin'::app_role, 'inspector'::app_role]));

DROP POLICY IF EXISTS "exam_configs read auth" ON public.exam_configs;
CREATE POLICY "exam_configs read staff" ON public.exam_configs FOR SELECT TO authenticated
  USING (public.current_role_any(ARRAY['admin'::app_role, 'inspector'::app_role]));

DROP POLICY IF EXISTS "ecq read auth" ON public.exam_category_questions;
CREATE POLICY "ecq read staff" ON public.exam_category_questions FOR SELECT TO authenticated
  USING (public.current_role_any(ARRAY['admin'::app_role, 'inspector'::app_role]));

DROP POLICY IF EXISTS "senal_assets read all" ON public.senal_assets;
CREATE POLICY "senal_assets read staff" ON public.senal_assets FOR SELECT TO authenticated
  USING (public.current_role_any(ARRAY['admin'::app_role, 'inspector'::app_role]));