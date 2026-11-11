import { llamarHoja } from "./canales/sheets.server";
import { calcularDesde, clasesDeExamen, diffConHoja, decidirEstado, formatoApellidoNombre } from "./turnos-utils";
import { featureActiva } from "./planes";

async function admin() { return (await import("@/integrations/supabase/client.server")).supabaseAdmin; }

async function bitacora(institucion_id: string, turno_id: string | null, canal: string, estado: string, detalle: string) {
  const sb = await admin();
  await sb.from("turno_envios").insert({ institucion_id, turno_id, canal, estado, detalle } as any);
}

export async function reservarTurno(turnoId: string, opt: { fecha?: string; hora?: string; conservarSiFalla?: boolean } = {}) {
  const sb = await admin();
  const { data: t } = await sb.from("turnos_practicos").select("*").eq("id", turnoId).single();
  if (!t) return { ok: false, motivo: "no_existe" };
  const { data: p } = await sb.from("profiles").select("nombre, apellido").eq("id", t.aspirante_id).maybeSingle();
  const { data: cfg } = await sb.from("turnos_config").select("dias_minimos_antes").eq("institucion_id", t.institucion_id).maybeSingle();
  const base = { id: t.id, clase: t.clase, apellidoNombre: formatoApellidoNombre(p?.apellido ?? "", p?.nombre ?? ""), claseTexto: t.clase };
  const r = opt.fecha && opt.hora ? await llamarHoja("reservarEn", { ...base, fecha: opt.fecha, hora: opt.hora })
    : await llamarHoja("reservar", { ...base, desde: opt.fecha ? `${opt.fecha}T00:00` : calcularDesde(cfg?.dias_minimos_antes ?? 1) });
  const d = decidirEstado(r);
  if (d.estado !== "asignado" && opt.conservarSiFalla) {
    await bitacora(t.institucion_id, t.id, "sheets", "error", String(r?.error ?? d.motivo ?? "error"));
    return { ok: false, motivo: d.motivo ?? "error_hoja", error: r?.error as string | undefined };
  }
  const upd: any = { estado: d.estado, motivo: d.motivo, updated_at: new Date().toISOString() };
  if (d.estado === "asignado") Object.assign(upd, { hoja: r.reserva.hoja, fila: r.reserva.fila, fecha: r.reserva.fecha, hora: r.reserva.hora });
  await sb.from("turnos_practicos").update(upd).eq("id", t.id);
  await bitacora(t.institucion_id, t.id, "sheets", r.ok ? "ok" : "error", r.ok ? (d.motivo ?? "reservado") : String(r.error ?? "error"));
  await sb.from("audit_log").insert({ accion: `turno_${d.estado}`, target_type: "turnos_practicos", target_id: t.id, meta: { motivo: d.motivo } } as any);
  if (d.estado === "asignado") await registrarEnHoja(t.id);
  return { ok: d.estado === "asignado", motivo: d.motivo };
}

/** Escribe/actualiza la fila del turno en la pestaña REGISTRO. Nunca rompe el flujo si falla. */
export async function registrarEnHoja(turnoId: string) {
  try {
    const sb = await admin();
    const { data: t } = await sb.from("turnos_practicos").select("*").eq("id", turnoId).maybeSingle();
    if (!t) return;
    const { data: p } = await sb.from("profiles").select("nombre, apellido, dni, telefono, email").eq("id", t.aspirante_id).maybeSingle();
    const { data: ins } = t.inspector_id ? await sb.from("profiles").select("nombre, apellido").eq("id", t.inspector_id).maybeSingle() : { data: null as any };
    const email = String(p?.email ?? "").endsWith("@aspirante.local") ? "" : p?.email ?? "";
    const fila = {
      "ID": t.id, "Fecha del turno": t.fecha ? String(t.fecha).split("-").reverse().join("/") : "", "Hora": String(t.hora ?? "").slice(0, 5),
      "Clase": t.clase ?? "", "Apellido": (p?.apellido ?? "").toUpperCase(), "Nombre": (p?.nombre ?? "").toUpperCase(), "DNI": p?.dni ?? "",
      "Teléfono": p?.telefono ?? "", "Correo": email, "Estado": t.estado, "Mensaje enviado por": "", "Fecha de envío": "",
      "Aprobó el teórico el": t.aprobado_teorico_at ? new Date(t.aprobado_teorico_at).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "",
      "Inspector": ins ? `${ins.apellido ?? ""} ${ins.nombre ?? ""}`.trim() : "", "Observaciones": t.motivo ?? "",
      "Actualizado": new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }),
    };
    const r: any = await llamarHoja("registro", { fila });
    if (!r?.ok) await bitacora(t.institucion_id, t.id, "registro", "error", String(r?.error ?? "error"));
  } catch { /* el registro es complementario */ }
}

/** Trae de la hoja la fecha/hora real de cada turno (si se movió a mano) y la guarda en el sistema. */
export async function sincronizarDesdeHoja(institucionId: string) {
  const sb = await admin();
  const { data: ts } = await sb.from("turnos_practicos").select("id, fecha, hora, hoja, fila, estado").eq("institucion_id", institucionId).in("estado", ["asignado", "reprogramado"]).limit(500);
  if (!ts?.length) return { ok: true, cambios: 0 };
  const r: any = await llamarHoja("estado", { ids: ts.map((t) => t.id) });
  if (!r?.ok) return { ok: false, cambios: 0, error: r?.error as string };
  let cambios = 0;
  for (const t of ts) {
    const d = diffConHoja(t as any, r.turnos?.[t.id]);
    if (!d) continue;
    await sb.from("turnos_practicos").update({ ...d, updated_at: new Date().toISOString() }).eq("id", t.id);
    await bitacora(institucionId, t.id, "sheets", "ok", `sincronizado desde la hoja: ${d.fecha} ${d.hora}`);
    await registrarEnHoja(t.id);
    cambios++;
  }
  return { ok: true, cambios };
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
