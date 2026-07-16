
-- ============================================================
-- SIED: Sistema Integral de Evaluación para Licencias de Conducir
-- Esquema inicial
-- ============================================================

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'inspector', 'aspirante');
CREATE TYPE public.license_class AS ENUM ('A','B','C','D','E','UNICA');
CREATE TYPE public.exam_status AS ENUM ('esperando','habilitado','rindiendo','finalizado','aprobado','desaprobado','cancelado');

-- ============================================================
-- profiles: datos de todos los usuarios (admin, inspector, aspirante)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dni TEXT UNIQUE,
  nombre TEXT NOT NULL DEFAULT '',
  apellido TEXT NOT NULL DEFAULT '',
  email TEXT,
  telefono TEXT,
  license_class public.license_class,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_dni ON public.profiles(dni);
CREATE INDEX idx_profiles_apellido ON public.profiles(lower(apellido));
CREATE INDEX idx_profiles_email ON public.profiles(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- user_roles + has_role
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_role_any(_roles public.app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_roles));
$$;

-- profile policies
CREATE POLICY "profiles read own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles read admin/inspector" ON public.profiles
  FOR SELECT USING (public.current_role_any(ARRAY['admin','inspector']::public.app_role[]));
CREATE POLICY "profiles update own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles admin manage" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles policies (read only for self and admin; writes via service_role)
CREATE POLICY "roles read own" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "roles admin read all" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- topics
-- ============================================================
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topics read all auth" ON public.topics FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "topics admin manage" ON public.topics FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- questions
-- ============================================================
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clase public.license_class NOT NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  pregunta TEXT NOT NULL,
  respuesta_correcta TEXT NOT NULL,
  respuestas_aceptadas TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  eliminatoria BOOLEAN NOT NULL DEFAULT false,
  peso INTEGER NOT NULL DEFAULT 1,
  nivel TEXT NOT NULL DEFAULT 'medio',
  activa BOOLEAN NOT NULL DEFAULT true,
  fuente TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_clase ON public.questions(clase) WHERE activa;
CREATE INDEX idx_questions_topic ON public.questions(topic_id);

GRANT SELECT ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions read auth" ON public.questions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "questions admin manage" ON public.questions FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- exam_configs (uno por clase)
-- ============================================================
CREATE TABLE public.exam_configs (
  clase public.license_class PRIMARY KEY,
  cantidad_preguntas INTEGER NOT NULL DEFAULT 20,
  duracion_minutos INTEGER NOT NULL DEFAULT 15,
  max_errores INTEGER NOT NULL DEFAULT 4,
  distribucion_temas JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exam_configs TO authenticated;
GRANT ALL ON public.exam_configs TO service_role;
ALTER TABLE public.exam_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_configs read auth" ON public.exam_configs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "exam_configs admin manage" ON public.exam_configs FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- exam_access_codes: código que emite el inspector
-- ============================================================
CREATE TABLE public.exam_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aspirante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL REFERENCES public.profiles(id),
  clase public.license_class NOT NULL,
  codigo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'habilitado', -- habilitado / usado / cancelado / expirado
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_codes_aspirante ON public.exam_access_codes(aspirante_id);
GRANT SELECT ON public.exam_access_codes TO authenticated;
GRANT ALL ON public.exam_access_codes TO service_role;
ALTER TABLE public.exam_access_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "codes read own aspirante" ON public.exam_access_codes
  FOR SELECT USING (aspirante_id = auth.uid());
CREATE POLICY "codes admin/inspector manage" ON public.exam_access_codes
  FOR ALL USING (public.current_role_any(ARRAY['admin','inspector']::public.app_role[]))
  WITH CHECK (public.current_role_any(ARRAY['admin','inspector']::public.app_role[]));

-- ============================================================
-- exams
-- ============================================================
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aspirante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inspector_id UUID REFERENCES public.profiles(id),
  clase public.license_class NOT NULL,
  status public.exam_status NOT NULL DEFAULT 'habilitado',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  total_preguntas INTEGER NOT NULL DEFAULT 0,
  correctas INTEGER NOT NULL DEFAULT 0,
  incorrectas INTEGER NOT NULL DEFAULT 0,
  puntaje INTEGER NOT NULL DEFAULT 0,
  eliminado_por_pregunta UUID REFERENCES public.questions(id),
  focus_lost_count INTEGER NOT NULL DEFAULT 0,
  config_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exams_aspirante ON public.exams(aspirante_id);
CREATE INDEX idx_exams_status ON public.exams(status);

GRANT SELECT, INSERT, UPDATE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exams read own aspirante" ON public.exams FOR SELECT USING (aspirante_id = auth.uid());
CREATE POLICY "exams read admin/inspector" ON public.exams FOR SELECT
  USING (public.current_role_any(ARRAY['admin','inspector']::public.app_role[]));
CREATE POLICY "exams aspirante update own" ON public.exams FOR UPDATE
  USING (aspirante_id = auth.uid()) WITH CHECK (aspirante_id = auth.uid());
CREATE POLICY "exams admin/inspector manage" ON public.exams FOR ALL
  USING (public.current_role_any(ARRAY['admin','inspector']::public.app_role[]))
  WITH CHECK (public.current_role_any(ARRAY['admin','inspector']::public.app_role[]));

-- ============================================================
-- exam_questions
-- ============================================================
CREATE TABLE public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id),
  orden INTEGER NOT NULL,
  respuesta_dada TEXT,
  correcta BOOLEAN,
  answered_at TIMESTAMPTZ,
  snapshot JSONB NOT NULL,
  UNIQUE(exam_id, orden)
);
CREATE INDEX idx_eq_exam ON public.exam_questions(exam_id);

GRANT SELECT, INSERT, UPDATE ON public.exam_questions TO authenticated;
GRANT ALL ON public.exam_questions TO service_role;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eq read own aspirante" ON public.exam_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.aspirante_id = auth.uid()));
CREATE POLICY "eq read admin/inspector" ON public.exam_questions FOR SELECT
  USING (public.current_role_any(ARRAY['admin','inspector']::public.app_role[]));
CREATE POLICY "eq aspirante update own" ON public.exam_questions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.aspirante_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.aspirante_id = auth.uid()));
CREATE POLICY "eq admin manage" ON public.exam_questions FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- audit_log
-- ============================================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  accion TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.audit_log FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit insert auth" ON public.audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- Timestamps trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_questions_touch BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_exams_touch BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_exam_configs_touch BEFORE UPDATE ON public.exam_configs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- Trigger: crear profile automáticamente al crear usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, dni, nombre, apellido, email, telefono, license_class)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'dni',
    COALESCE(NEW.raw_user_meta_data->>'nombre',''),
    COALESCE(NEW.raw_user_meta_data->>'apellido',''),
    NEW.email,
    NEW.raw_user_meta_data->>'telefono',
    (NEW.raw_user_meta_data->>'license_class')::public.license_class
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Configs por defecto
-- ============================================================
INSERT INTO public.exam_configs (clase, cantidad_preguntas, duracion_minutos, max_errores) VALUES
  ('A',20,15,4),('B',20,15,4),('C',20,15,4),('D',25,20,5),('E',20,15,4),('UNICA',20,15,4);

-- ============================================================
-- Temas
-- ============================================================
INSERT INTO public.topics (slug, nombre) VALUES
  ('prioridades','Prioridades de paso'),
  ('senales','Señales de tránsito'),
  ('velocidades','Velocidades máximas'),
  ('documentacion','Documentación y licencia'),
  ('alcoholemia','Alcoholemia'),
  ('seguridad','Elementos de seguridad'),
  ('luces','Luces y visibilidad'),
  ('estacionamiento','Estacionamiento'),
  ('primeros-auxilios','Primeros auxilios'),
  ('motocicleta','Motocicletas'),
  ('carga','Transporte de carga y pasajeros'),
  ('estrella-amarilla','Estrella Amarilla'),
  ('sanciones','Sanciones y retención'),
  ('general','General');
