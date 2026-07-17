// Modo emulador para admin: corre un examen de prueba con la misma lógica
// que el real y al finalizar devuelve la revisión pregunta-por-pregunta.
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
    clase: z.enum(["A","B","C","D","E","UNICA"]),
    cantidad: z.number().int().min(1).max(60).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin.from("exam_configs").select("*").eq("clase", data.clase).maybeSingle();
    const cantidad = data.cantidad ?? cfg?.cantidad_preguntas ?? 20;
    const duracion = cfg?.duracion_minutos ?? 15;
    const maxErrores = cfg?.max_errores ?? 4;
    const clases = (data.clase === "UNICA" ? ["UNICA"] : [data.clase, "UNICA"]) as ("A"|"B"|"C"|"D"|"E"|"UNICA")[];
    const { data: pool } = await supabaseAdmin
      .from("questions")
      .select("id, pregunta, eliminatoria, respuesta_correcta, respuestas_aceptadas, peso")
      .in("clase", clases).eq("activa", true);
    if (!pool || pool.length === 0) throw new Error("No hay preguntas disponibles para esta clase.");
    const shuffled = pool.map((v) => ({ v, s: Math.random() })).sort((a,b)=>a.s-b.s).map((x) => x.v);
    const selected = shuffled.slice(0, Math.min(cantidad, shuffled.length));

    const now = new Date().toISOString();
    const { data: exam, error } = await supabaseAdmin.from("exams").insert({
      aspirante_id: context.userId, inspector_id: context.userId, clase: data.clase,
      status: "rindiendo", started_at: now, is_emulation: true,
      total_preguntas: selected.length,
      config_snapshot: { cantidad, duracion_minutos: duracion, max_errores: maxErrores },
    }).select().single();
    if (error) throw error;

    const rows = selected.map((q, i) => ({
      exam_id: exam.id, question_id: q.id, orden: i + 1,
      snapshot: { pregunta: q.pregunta, eliminatoria: q.eliminatoria, peso: q.peso },
    }));
    await supabaseAdmin.from("exam_questions").insert(rows);
    const { data: qs } = await supabaseAdmin.from("exam_questions")
      .select("id, orden, snapshot").eq("exam_id", exam.id).order("orden");
    return { exam, questions: qs ?? [] };
  });

export const responderEmulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    examQuestionId: z.string().uuid(), respuesta: z.string().max(500),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: eq } = await supabaseAdmin.from("exam_questions").select("*, exams!inner(is_emulation)").eq("id", data.examQuestionId).single();
    if (!eq || !(eq as any).exams?.is_emulation) throw new Error("Emulación no encontrada.");
    const { data: q } = await supabaseAdmin.from("questions")
      .select("respuesta_correcta, respuestas_aceptadas, eliminatoria").eq("id", eq.question_id).single();
    const correcta = answersMatch(data.respuesta, q!.respuesta_correcta, q!.respuestas_aceptadas ?? []);
    await supabaseAdmin.from("exam_questions").update({
      respuesta_dada: data.respuesta, correcta, answered_at: new Date().toISOString(),
    }).eq("id", data.examQuestionId);
    return {
      correcta, esperada: q!.respuesta_correcta,
      aceptadas: q!.respuestas_aceptadas ?? [], eliminatoria: q!.eliminatoria,
    };
  });

export const finalizarEmulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ examId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam } = await supabaseAdmin.from("exams").select("*").eq("id", data.examId).single();
    if (!exam || !exam.is_emulation) throw new Error("Emulación no encontrada.");
    const { data: eqs } = await supabaseAdmin.from("exam_questions")
      .select("id, orden, snapshot, respuesta_dada, correcta, question_id")
      .eq("exam_id", data.examId).order("orden");
    const qIds = (eqs ?? []).map((e) => e.question_id);
    const { data: qs } = await supabaseAdmin.from("questions")
      .select("id, respuesta_correcta, respuestas_aceptadas, topics(nombre)").in("id", qIds);
    const qMap = new Map((qs ?? []).map((q: any) => [q.id, q]));
    const revision = (eqs ?? []).map((e) => {
      const q: any = qMap.get(e.question_id);
      return {
        orden: e.orden,
        pregunta: (e.snapshot as any)?.pregunta,
        eliminatoria: (e.snapshot as any)?.eliminatoria,
        respuesta_dada: e.respuesta_dada,
        respuesta_correcta: q?.respuesta_correcta,
        respuestas_aceptadas: q?.respuestas_aceptadas ?? [],
        tema: q?.topics?.nombre ?? null,
        correcta: e.correcta,
      };
    });
    const correctas = revision.filter((r) => r.correcta === true).length;
    const incorrectas = revision.filter((r) => r.correcta === false).length;
    const maxErr = (exam.config_snapshot as any)?.max_errores ?? 4;
    const status = incorrectas <= maxErr ? "aprobado" : "desaprobado";
    await supabaseAdmin.from("exams").update({
      status, finished_at: new Date().toISOString(),
      correctas, incorrectas, puntaje: correctas,
    }).eq("id", data.examId);
    return { status, correctas, incorrectas, total: revision.length, revision };
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
