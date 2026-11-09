CREATE TABLE public.turnos_config (
  institucion_id uuid PRIMARY KEY DEFAULT public.current_institucion(),
  lugar text NOT NULL DEFAULT '',
  mensaje_reglas text NOT NULL DEFAULT '',
  dias_minimos_antes int NOT NULL DEFAULT 1,
  enviar_email boolean NOT NULL DEFAULT true,
  whatsapp_modo text NOT NULL DEFAULT 'manual',
  regla_lluvia_moto boolean NOT NULL DEFAULT true,
  sheet_url text,
  aviso_sin_cupo text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.turnos_config TO authenticated;
GRANT ALL ON public.turnos_config TO service_role;
ALTER TABLE public.turnos_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff gestiona config turnos" ON public.turnos_config FOR ALL TO authenticated
  USING (institucion_id = public.current_institucion() AND public.current_role_any(ARRAY['admin'::app_role,'inspector'::app_role]))
  WITH CHECK (institucion_id = public.current_institucion() AND public.current_role_any(ARRAY['admin'::app_role,'inspector'::app_role]));

CREATE TABLE public.turnos_practicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL DEFAULT public.current_institucion(),
  exam_id uuid NOT NULL UNIQUE,
  aspirante_id uuid NOT NULL,
  categoria_slug text,
  clase text,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('asignado','pendiente','reprogramado','cancelado','presente','ausente')),
  motivo text,
  hoja text, fila int, fecha date, hora time,
  aprobado_teorico_at timestamptz,
  inspector_id uuid,
  email_enviado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX turnos_activos_unicos ON public.turnos_practicos (aspirante_id, categoria_slug) WHERE estado IN ('asignado','pendiente','reprogramado');
GRANT SELECT ON public.turnos_practicos TO authenticated;
GRANT ALL ON public.turnos_practicos TO service_role;
ALTER TABLE public.turnos_practicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aislamiento institucion" ON public.turnos_practicos AS RESTRICTIVE FOR ALL TO authenticated
  USING (institucion_id = public.current_institucion() OR aspirante_id = auth.uid());
CREATE POLICY "staff lee turnos" ON public.turnos_practicos FOR SELECT TO authenticated
  USING (public.current_role_any(ARRAY['admin'::app_role,'inspector'::app_role]));
CREATE POLICY "aspirante lee su turno" ON public.turnos_practicos FOR SELECT TO authenticated
  USING (aspirante_id = auth.uid());

CREATE TABLE public.turno_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL DEFAULT public.current_institucion(),
  turno_id uuid,
  canal text NOT NULL CHECK (canal IN ('email','whatsapp','sheets')),
  destino text,
  estado text NOT NULL CHECK (estado IN ('ok','error','omitido')),
  detalle text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.turno_envios TO authenticated;
GRANT ALL ON public.turno_envios TO service_role;
ALTER TABLE public.turno_envios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff lee envios" ON public.turno_envios FOR SELECT TO authenticated
  USING (institucion_id = public.current_institucion() AND public.current_role_any(ARRAY['admin'::app_role,'inspector'::app_role]));

INSERT INTO public.turnos_config (institucion_id, lugar, mensaje_reglas, aviso_sin_cupo)
SELECT id, 'Estación Ferrocarril (ENTRE RÍOS Y CONSTITUCIÓN)',
E'IMPORTANTE:\n1- Respetar día y horario; caso contrario se considerará desaprobado.\n2- Usar los elementos de seguridad siempre.\n3- El vehículo debe ser conducido por una persona con licencia habilitante vigente.\n4- El vehículo debe estar en condiciones para circular en la vía pública: luces, chapa patente, matafuego en el lugar que corresponde, etc., según Art. 29 y Art. 40, Ley 24.449.\n5- Llevar el Formulario Único de Trámite y DNI.\n6- Si rendís MOTO y llueve, se pasa para el viernes siguiente a la misma hora en que se te citó.\n7- Una vez que hayas aprobado el examen, volvé a llevar el formulario a la oficina para que te impriman la licencia. La licencia se imprime de un día para el otro.',
'Te avisaremos cuando haya fecha para tu examen práctico.'
FROM public.instituciones WHERE es_principal = true
ON CONFLICT DO NOTHING;