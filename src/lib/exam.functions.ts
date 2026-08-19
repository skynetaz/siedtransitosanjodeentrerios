// Server functions del motor de examen.
// Diseño: el aspirante nunca ve la respuesta correcta desde el cliente.
// Todas las operaciones de examen (iniciar / responder / finalizar) pasan
// por acá y responden solo con lo estrictamente necesario.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { answersMatch } from "@/lib/normalize";

// ---------------------------------------------------------------
// Obtener el examen habilitado actual del aspirante autenticado
// ---------------------------------------------------------------
export const getMyExam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("exams")
      .select("id, clase, status, started_at, finished_at, total_preguntas, correctas, incorrectas, puntaje, config_snapshot")
      .eq("aspirante_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

// ---------------------------------------------------------------
// Iniciar examen: pasa de 'habilitado' → 'rindiendo', selecciona preguntas
// aleatorias según la config, y crea exam_questions con snapshot sin
// respuesta correcta.
// ---------------------------------------------------------------
export const iniciarExamen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam, error: eErr } = await supabaseAdmin.from("exams").select("*").eq("id", data.examId).single();
    if (eErr) throw eErr;
    if (exam.aspirante_id !== context.userId) throw new Error("Este examen no te pertenece.");
    if (exam.status === "rindiendo") {
      // Reanudar
      const { data: qs } = await supabaseAdmin.from("exam_questions")
        .select("id, orden, snapshot, respuesta_dada")
        .eq("exam_id", data.examId).order("orden");
      return { exam, questions: qs ?? [] };
    }
    if (exam.status !== "habilitado") throw new Error("El examen no está habilitado.");

    const { resolverCategoria, seleccionarPreguntas } = await import("@/lib/seleccion.server");
    const cat = await resolverCategoria(supabaseAdmin, exam.categoria_slug, exam.clase);
    const seleccion = await seleccionarPreguntas(supabaseAdmin, cat);
    const duracion = cat.duracion_minutos;
    const maxErrores = cat.max_errores;
    const now = new Date().toISOString();
    const rows = seleccion.map((r) => ({ ...r, exam_id: data.examId }));

    await supabaseAdmin.from("exam_questions").delete().eq("exam_id", data.examId); // limpio por si acaso
    const { error: iErr } = await supabaseAdmin.from("exam_questions").insert(rows);
    if (iErr) throw iErr;

    const { error: uErr } = await supabaseAdmin.from("exams").update({
      status: "rindiendo",
      started_at: now,
      total_preguntas: rows.length,
      config_snapshot: {
        categoria: cat.slug, nombre: cat.nombre, cantidad: rows.length,
        duracion_minutos: duracion, max_errores: maxErrores,
      },
    }).eq("id", data.examId);
    if (uErr) throw uErr;

    const { data: qs } = await supabaseAdmin.from("exam_questions")
      .select("id, orden, snapshot, respuesta_dada")
      .eq("exam_id", data.examId).order("orden");
    const { data: updatedExam } = await supabaseAdmin.from("exams").select("*").eq("id", data.examId).single();
    return { exam: updatedExam, questions: qs ?? [] };
  });

// ---------------------------------------------------------------
// Responder pregunta: guarda respuesta, evalúa. Si es eliminatoria y
// falla → desaprobado inmediato. Devuelve solo si la pregunta fue
// correcta e info mínima; no expone la respuesta correcta.
// ---------------------------------------------------------------
export const responderPregunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    examQuestionId: z.string().uuid(),
    respuesta: z.string().max(500),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: eq, error } = await supabaseAdmin.from("exam_questions").select("*, exams!inner(*)").eq("id", data.examQuestionId).single();
    if (error) throw error;
    if (eq.exams.aspirante_id !== context.userId) throw new Error("No autorizado.");
    if (eq.exams.status !== "rindiendo") throw new Error("El examen no está en curso.");

    const { data: q } = await supabaseAdmin.from("questions").select("respuesta_correcta, respuestas_aceptadas, eliminatoria").eq("id", eq.question_id).single();
    if (!q) throw new Error("Pregunta no encontrada.");

    const correcta = answersMatch(data.respuesta, q.respuesta_correcta, q.respuestas_aceptadas ?? []);
    await supabaseAdmin.from("exam_questions").update({
      respuesta_dada: data.respuesta, correcta, answered_at: new Date().toISOString(),
    }).eq("id", data.examQuestionId);

    // Si es eliminatoria y falla → cerrar examen desaprobado
    if (q.eliminatoria && !correcta) {
      const now = new Date().toISOString();
      const { data: allEq } = await supabaseAdmin.from("exam_questions").select("correcta").eq("exam_id", eq.exam_id);
      const correctas = (allEq ?? []).filter((r) => r.correcta === true).length;
      const incorrectas = (allEq ?? []).filter((r) => r.correcta === false).length;
      await supabaseAdmin.from("exams").update({
        status: "desaprobado", finished_at: now, correctas, incorrectas,
        eliminado_por_pregunta: eq.question_id, puntaje: correctas,
      }).eq("id", eq.exam_id);
      return { correcta: false, terminado: true, motivo: "eliminatoria" as const };
    }
    return { correcta, terminado: false };
  });

// ---------------------------------------------------------------
// Finalizar examen: computa puntaje y estado final.
// ---------------------------------------------------------------
export const finalizarExamen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam } = await supabaseAdmin.from("exams").select("*").eq("id", data.examId).single();
    if (!exam) throw new Error("Examen no encontrado.");
    if (exam.aspirante_id !== context.userId) throw new Error("No autorizado.");
    if (exam.status !== "rindiendo") return { ok: true, status: exam.status };

    const { data: allEq } = await supabaseAdmin.from("exam_questions").select("correcta").eq("exam_id", data.examId);
    const correctas = (allEq ?? []).filter((r) => r.correcta === true).length;
    const incorrectas = (allEq ?? []).filter((r) => r.correcta === false).length;
    const cfg = exam.config_snapshot as { max_errores?: number } | null;
    const maxErr = cfg?.max_errores ?? 4;
    const status = incorrectas <= maxErr ? "aprobado" : "desaprobado";
    const finished = new Date();
    const started = exam.started_at ? new Date(exam.started_at) : finished;
    const total = exam.total_preguntas || (allEq ?? []).length || 1;
    await supabaseAdmin.from("exams").update({
      status, finished_at: finished.toISOString(),
      correctas, incorrectas, puntaje: correctas,
      porcentaje: Math.round((correctas / total) * 100),
      tiempo_utilizado_seg: Math.round((finished.getTime() - started.getTime()) / 1000),
      motivo_finalizacion: exam.motivo_finalizacion ?? "finalizado por el aspirante",
    }).eq("id", data.examId);
    return { ok: true, status, correctas, incorrectas };
  });

// ---------------------------------------------------------------
// Registrar pérdida de foco (posible intento de trampa)
// ---------------------------------------------------------------
export const registrarFocusLoss = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam } = await supabaseAdmin.from("exams").select("focus_lost_count, aspirante_id").eq("id", data.examId).single();
    if (!exam || exam.aspirante_id !== context.userId) return { ok: false };
    await supabaseAdmin.from("exams").update({ focus_lost_count: (exam.focus_lost_count ?? 0) + 1 }).eq("id", data.examId);
    return { ok: true };
  });
