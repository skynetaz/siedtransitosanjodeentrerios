import { llamarHoja } from "./canales/sheets.server";
import { calcularDesde, clasesDeExamen, decidirEstado, formatoApellidoNombre } from "./turnos-utils";
import { featureActiva } from "./planes";

async function admin() { return (await import("@/integrations/supabase/client.server")).supabaseAdmin; }

async function bitacora(institucion_id: string, turno_id: string | null, canal: string, estado: string, detalle: string) {
  const sb = await admin();
  await sb.from("turno_envios").insert({ institucion_id, turno_id, canal, estado, detalle } as any);
}

export async function reservarTurno(turnoId: string, opt: { fecha?: string; hora?: string } = {}) {
  const sb = await admin();
  const { data: t } = await sb.from("turnos_practicos").select("*").eq("id", turnoId).single();
  if (!t) return;
  const { data: p } = await sb.from("profiles").select("nombre, apellido").eq("id", t.aspirante_id).maybeSingle();
  const { data: cfg } = await sb.from("turnos_config").select("dias_minimos_antes").eq("institucion_id", t.institucion_id).maybeSingle();
  const base = { id: t.id, clase: t.clase, apellidoNombre: formatoApellidoNombre(p?.apellido ?? "", p?.nombre ?? ""), claseTexto: t.clase };
  const r = opt.fecha && opt.hora ? await llamarHoja("reservarEn", { ...base, fecha: opt.fecha, hora: opt.hora })
    : await llamarHoja("reservar", { ...base, desde: opt.fecha ? `${opt.fecha}T00:00` : calcularDesde(cfg?.dias_minimos_antes ?? 1) });
  const d = decidirEstado(r);
  const upd: any = { estado: d.estado, motivo: d.motivo, updated_at: new Date().toISOString() };
  if (d.estado === "asignado") Object.assign(upd, { hoja: r.reserva.hoja, fila: r.reserva.fila, fecha: r.reserva.fecha, hora: r.reserva.hora });
  await sb.from("turnos_practicos").update(upd).eq("id", t.id);
  await bitacora(t.institucion_id, t.id, "sheets", r.ok ? "ok" : "error", r.ok ? (d.motivo ?? "reservado") : String(r.error ?? "error"));
  await sb.from("audit_log").insert({ accion: `turno_${d.estado}`, target_type: "turnos_practicos", target_id: t.id, meta: { motivo: d.motivo } } as any);
}

export async function asignarTurnoParaExamen(examId: string) {
  const sb = await admin();
  const { data: ex } = await sb.from("exams").select("id, status, is_emulation, institucion_id, aspirante_id, categoria_slug, clase, clases_incluidas, finished_at, inspector_id").eq("id", examId).single();
  if (!ex || ex.status !== "aprobado" || ex.is_emulation || !ex.institucion_id) return;
  const { data: inst } = await sb.from("instituciones").select("features").eq("id", ex.institucion_id).maybeSingle();
  const { data: cfg } = await sb.from("turnos_config").select("institucion_id").eq("institucion_id", ex.institucion_id).maybeSingle();
  if (!cfg || !featureActiva(inst?.features as any, "turnos")) return;
  const { data: ya } = await sb.from("turnos_practicos").select("clase").eq("exam_id", examId);
  const hechas = new Set((ya ?? []).map((r: any) => r.clase ?? ""));
  const clases = clasesDeExamen(ex.clase as any, (ex as any).clases_incluidas);
  const lista: (string | null)[] = clases.length ? clases : [null];
  for (const clase of lista) {
    if (hechas.has(clase ?? "")) continue;
    const { data: t, error } = await sb.from("turnos_practicos").insert({
      institucion_id: ex.institucion_id, exam_id: ex.id, aspirante_id: ex.aspirante_id, categoria_slug: ex.categoria_slug,
      clase, estado: "pendiente", motivo: clase ? null : "sin_clase",
      aprobado_teorico_at: ex.finished_at, inspector_id: ex.inspector_id,
    } as any).select("id").single();
    if (error || !t) { await bitacora(ex.institucion_id, null, "sheets", "error", "no se pudo crear el turno"); continue; }
    if (clase) await reservarTurno(t.id);
  }
}

export async function asignarPendientes(institucionId?: string) {
  const sb = await admin();
  let q = sb.from("turnos_practicos").select("id").eq("estado", "pendiente").in("motivo", ["sin_cupo", "error_hoja"]).order("aprobado_teorico_at").limit(50);
  if (institucionId) q = q.eq("institucion_id", institucionId);
  const { data } = await q;
  for (const t of data ?? []) await reservarTurno(t.id);
  return (data ?? []).length;
}
