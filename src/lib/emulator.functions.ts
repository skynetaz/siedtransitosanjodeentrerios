// Modo emulador para admin: corre un examen de prueba con la misma lógica
// que el real y al finalizar devuelve la revisión pregunta-por-pregunta.
// El aspirante responde en el dispositivo y se envía todo junto al final,
// para no depender de una llamada al servidor por pregunta.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { answersMatch } from "@/lib/normalize";

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Solo administradores.");
}

export const startEmulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    categoria: z.string().trim().min(1),
    cantidad: z.number().int().min(1).max(80).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolverCategoria, seleccionarPreguntas } = await import("@/lib/seleccion.server");
    const cat = await resolverCategoria(supabaseAdmin, data.categoria, "UNICA");
    if (data.cantidad) cat.cantidad_preguntas = data.cantidad;
    const rows = await seleccionarPreguntas(supabaseAdmin, cat);

    const claseExamen = (cat.clases.find((c) => c !== "UNICA") ?? "UNICA") as any;
    const now = new Date().toISOString();
    const { data: exam, error } = await supabaseAdmin.from("exams").insert({
      aspirante_id: context.userId, inspector_id: context.userId, clase: claseExamen,
      categoria_slug: cat.slug, clases_incluidas: cat.clases,
      status: "rindiendo", started_at: now, is_emulation: true,
      total_preguntas: rows.length,
      config_snapshot: {
        categoria: cat.slug, nombre: cat.nombre,
        cantidad: rows.length, duracion_minutos: cat.duracion_minutos, max_errores: cat.max_errores,
      },
    }).select().single();
    if (error) throw error;

    const { error: iErr } = await supabaseAdmin.from("exam_questions")
      .insert(rows.map((r) => ({ ...r, exam_id: exam.id })));
    if (iErr) throw iErr;

    const { data: qs } = await supabaseAdmin.from("exam_questions")
      .select("id, orden, snapshot").eq("exam_id", exam.id).order("orden");
    return { exam, questions: qs ?? [], categoria: cat };
  });

/** Corrige todas las respuestas juntas y devuelve la revisión completa. */
export const finalizarEmulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    examId: z.string().uuid(),
    respuestas: z.array(z.object({
      examQuestionId: z.string().uuid(),
      respuesta: z.string().max(500),
    })).max(200).default([]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam } = await supabaseAdmin.from("exams").select("*").eq("id", data.examId).single();
    if (!exam || !exam.is_emulation) throw new Error("Emulación no encontrada.");

    const { data: eqs } = await supabaseAdmin.from("exam_questions")
      .select("id, orden, snapshot, question_id")
      .eq("exam_id", data.examId).order("orden");
    const qIds = (eqs ?? []).map((e) => e.question_id);
    const { data: qs } = await supabaseAdmin.from("questions")
      .select("id, respuesta_correcta, respuestas_aceptadas, eliminatoria, topics(nombre)").in("id", qIds);
    const qMap = new Map((qs ?? []).map((q: any) => [q.id, q]));
    const dadas = new Map(data.respuestas.map((r) => [r.examQuestionId, r.respuesta]));

    const now = new Date().toISOString();
    const revision = (eqs ?? []).map((e) => {
      const q: any = qMap.get(e.question_id);
      const dada = dadas.get(e.id) ?? null;
      const correcta = dada ? answersMatch(dada, q?.respuesta_correcta ?? "", q?.respuestas_aceptadas ?? []) : false;
      return {
        id: e.id,
        orden: e.orden,
        pregunta: (e.snapshot as any)?.pregunta,
        eliminatoria: q?.eliminatoria ?? (e.snapshot as any)?.eliminatoria,
        respuesta_dada: dada,
        respuesta_correcta: q?.respuesta_correcta,
        respuestas_aceptadas: q?.respuestas_aceptadas ?? [],
        tema: q?.topics?.nombre ?? null,
        correcta,
      };
    });

    // Guardado de respuestas (no bloquea la revisión si alguna falla).
    for (const r of revision) {
      if (r.respuesta_dada === null) continue;
      await supabaseAdmin.from("exam_questions").update({
        respuesta_dada: r.respuesta_dada, correcta: r.correcta, answered_at: now,
      }).eq("id", r.id);
    }

    const correctas = revision.filter((r) => r.correcta).length;
    const incorrectas = revision.filter((r) => !r.correcta && r.respuesta_dada !== null).length;
    const fallóEliminatoria = revision.some((r) => r.eliminatoria && !r.correcta && r.respuesta_dada !== null);
    const maxErr = (exam.config_snapshot as any)?.max_errores ?? 4;
    const status = !fallóEliminatoria && incorrectas <= maxErr ? "aprobado" : "desaprobado";
    await supabaseAdmin.from("exams").update({
      status, finished_at: now, correctas, incorrectas, puntaje: correctas,
      porcentaje: revision.length ? Math.round((correctas / revision.length) * 100) : 0,
      motivo_finalizacion: fallóEliminatoria ? "falló una pregunta eliminatoria" : "finalizado",
    }).eq("id", data.examId);

    return { status, correctas, incorrectas, total: revision.length, eliminatoria: fallóEliminatoria, revision };
  });

export const eliminarEmulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ examId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ex } = await supabaseAdmin.from("exams").select("is_emulation").eq("id", data.examId).single();
    if (!ex?.is_emulation) throw new Error("Solo se pueden eliminar emulaciones.");
    await supabaseAdmin.from("exam_questions").delete().eq("exam_id", data.examId);
    await supabaseAdmin.from("exams").delete().eq("id", data.examId);
    return { ok: true };
  });

export const listMyEmulations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("exams").select("*")
      .eq("is_emulation", true).eq("aspirante_id", context.userId)
      .order("created_at", { ascending: false }).limit(30);
    return data ?? [];
  });
