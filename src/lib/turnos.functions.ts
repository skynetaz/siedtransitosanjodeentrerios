import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function staff(ctx: any) {
  const { data: ok } = await ctx.supabase.rpc("current_role_any", { _roles: ["admin", "inspector"] });
  if (!ok) throw new Error("No autorizado.");
  const { data: inst } = await ctx.supabase.rpc("current_institucion");
  return inst as string;
}

export const listarTurnos = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const inst = await staff(context);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sincronizarDesdeHoja } = await import("./turnos.server");
  const sync = await sincronizarDesdeHoja(inst).catch(() => ({ ok: false, cambios: 0 }));
  const { data: turnos } = await supabaseAdmin.from("turnos_practicos").select("*").eq("institucion_id", inst).order("fecha", { ascending: true, nullsFirst: false }).order("hora", { ascending: true, nullsFirst: false }).order("aprobado_teorico_at", { ascending: true }).limit(500);
  const ids = [...new Set((turnos ?? []).map((t) => t.aspirante_id))];
  const { data: perfiles } = ids.length ? await supabaseAdmin.from("profiles").select("id, nombre, apellido, dni, telefono, email").in("id", ids) : { data: [] as any[] };
  const pm = new Map((perfiles ?? []).map((p: any) => [p.id, p]));
  const { data: config } = await supabaseAdmin.from("turnos_config").select("*").eq("institucion_id", inst).maybeSingle();
  return { sync, config, turnos: (turnos ?? []).map((t) => ({ ...t, persona: pm.get(t.aspirante_id) ?? null })) };
});

export const guardarConfigTurnos = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ lugar: z.string().max(300), mensaje_reglas: z.string().max(5000), dias_minimos_antes: z.number().int().min(0).max(60), enviar_email: z.boolean(), sheet_url: z.string().max(500).nullable(), aviso_sin_cupo: z.string().max(500).nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const inst = await staff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("turnos_config").upsert({ institucion_id: inst, ...data, updated_at: new Date().toISOString() });
    return { ok: true };
  });

export const probarHoja = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await staff(context);
  const { llamarHoja } = await import("./canales/sheets.server");
  return await llamarHoja("ping");
});

export const disponibilidadHoja = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await staff(context);
  const { llamarHoja } = await import("./canales/sheets.server");
  const { calcularDesde } = await import("./turnos-utils");
  return await llamarHoja("disponibilidad", { desde: calcularDesde(0) });
});

export const accionTurno = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), accion: z.enum(["cancelar", "reasignar", "presente", "ausente", "clase"]), clase: z.enum(["A", "B", "C", "D", "E"]).optional(), fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), hora: z.string().regex(/^\d{1,2}:\d{2}$/).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const inst = await staff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin.from("turnos_practicos").select("id, institucion_id").eq("id", data.id).eq("institucion_id", inst).maybeSingle();
    if (!t) throw new Error("Turno no encontrado.");
    const { llamarHoja } = await import("./canales/sheets.server");
    const { reservarTurno } = await import("./turnos.server");
    const now = new Date().toISOString();
    if (data.accion === "cancelar") { await llamarHoja("liberar", { id: t.id }); await supabaseAdmin.from("turnos_practicos").update({ estado: "cancelado", updated_at: now }).eq("id", t.id); }
    else if (data.accion === "reasignar") {
      const { data: prev } = await supabaseAdmin.from("turnos_practicos").select("fecha, hora").eq("id", t.id).single();
      let res: any;
      if (data.fecha && data.hora) {
        // reservarEn mueve el lugar en la hoja (libera el anterior solo si consigue el nuevo día)
        res = await reservarTurno(t.id, { fecha: data.fecha, hora: data.hora, conservarSiFalla: true });
      } else {
        const lib: any = await llamarHoja("liberar", { id: t.id });
        if (lib && lib.ok === false) throw new Error(lib.error ?? "No se pudo liberar el lugar en la hoja.");
        res = await reservarTurno(t.id, { fecha: data.fecha, conservarSiFalla: true });
      }
      if (!res.ok) {
        // la hoja pudo haber borrado el lugar anterior: se vuelve a anotar en el mismo día y hora
        if (prev?.fecha && prev?.hora) await reservarTurno(t.id, { fecha: prev.fecha, hora: String(prev.hora).slice(0, 5), conservarSiFalla: true });
        const m: Record<string, string> = { sin_cupo: "No hay lugar libre desde esa fecha. Elegí otra fecha u hora.", sin_horario: "Ese horario no existe en la pestaña de ese día. Elegí uno de los horarios de la hoja (ej. 14:00, 14:15).", sin_hoja: "No hay ninguna pestaña de esa clase para copiar." };
        throw new Error((m[res.motivo] ?? res.error ?? "La hoja no confirmó el nuevo turno.") + " El turno anterior se mantiene.");
      }
    }
    else if (data.accion === "clase") { await supabaseAdmin.from("turnos_practicos").update({ clase: data.clase, motivo: null, updated_at: now }).eq("id", t.id); await reservarTurno(t.id); }
    else await supabaseAdmin.from("turnos_practicos").update({ estado: data.accion, updated_at: now }).eq("id", t.id);
    if (data.accion !== "reasignar") { const { registrarEnHoja } = await import("./turnos.server"); await registrarEnHoja(t.id); }
    await supabaseAdmin.from("audit_log").insert({ user_id: context.userId, accion: `turno_${data.accion}`, target_type: "turnos_practicos", target_id: t.id } as any);
    return { ok: true };
  });

export const asignarPendientesFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const inst = await staff(context);
  const { asignarPendientes } = await import("./turnos.server");
  return { procesados: await asignarPendientes(inst) };
});

export const miTurno = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ examId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: t } = await context.supabase.from("turnos_practicos").select("estado, fecha, hora, clase, institucion_id").eq("exam_id", data.examId).eq("aspirante_id", context.userId).order("fecha", { ascending: true, nullsFirst: false }).limit(1).maybeSingle();
    if (!t) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("turnos_config").select("lugar, mensaje_reglas, aviso_sin_cupo").eq("institucion_id", t.institucion_id).maybeSingle();
    return { estado: t.estado, fecha: t.fecha, hora: t.hora, clase: t.clase, lugar: c?.lugar ?? "", reglas: c?.mensaje_reglas ?? "", aviso: c?.aviso_sin_cupo ?? "Te avisaremos cuando haya fecha." };
  });
