ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_user_id_fkey,
  ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.exam_access_codes DROP CONSTRAINT exam_access_codes_inspector_id_fkey,
  ADD CONSTRAINT exam_access_codes_inspector_id_fkey FOREIGN KEY (inspector_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.exam_access_codes DROP CONSTRAINT exam_access_codes_created_by_fkey,
  ADD CONSTRAINT exam_access_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.exams DROP CONSTRAINT exams_inspector_id_fkey,
  ADD CONSTRAINT exams_inspector_id_fkey FOREIGN KEY (inspector_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.senal_assets DROP CONSTRAINT senal_assets_created_by_fkey,
  ADD CONSTRAINT senal_assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;