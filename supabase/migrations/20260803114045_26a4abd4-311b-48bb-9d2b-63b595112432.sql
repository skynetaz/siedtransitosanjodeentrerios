-- 1. audit_log: force user_id = auth.uid()
DROP POLICY IF EXISTS "audit insert auth" ON public.audit_log;
CREATE POLICY "audit insert own" ON public.audit_log
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 2. questions: only admin/inspector can read (answers included)
DROP POLICY IF EXISTS "questions read auth" ON public.questions;
CREATE POLICY "questions read staff" ON public.questions
FOR SELECT TO authenticated
USING (public.current_role_any(ARRAY['admin'::public.app_role, 'inspector'::public.app_role]));

-- 3. Revoke EXECUTE on trigger / internal SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_role_any(public.app_role[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_role_any(public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;