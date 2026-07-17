import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertStaff(context: any) {
  const [{ data: a }, { data: i }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "inspector" }),
  ]);
  if (!a && !i) throw new Error("Sin permisos.");
  return { isAdmin: !!a, isInspector: !!i };
}

export const listExamsArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    estado: z.enum(["todos","aprobado","desaprobado","pendiente_firma"]).default("todos"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("exams")
      .select("id, clase, status, finished_at, correctas, incorrectas, total_preguntas, is_emulation, signature_aspirante, signature_inspector, datos_aspirante, profiles!exams_aspirante_id_fkey(dni,nombre,apellido,email,telefono)")
      .eq("is_emulation", false)
      .in("status", ["aprobado","desaprobado"])
      .order("finished_at", { ascending: false })
      .limit(200);
    if (data.estado === "aprobado" || data.estado === "desaprobado") query = query.eq("status", data.estado);
    if (data.estado === "pendiente_firma") query = query.is("signature_inspector", null);
    const { data: rows, error } = await query;
    if (error) throw error;
    return rows ?? [];
  });

export const getExamDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ examId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam } = await supabaseAdmin.from("exams")
      .select("*, profiles!exams_aspirante_id_fkey(dni,nombre,apellido,email,telefono)")
      .eq("id", data.examId).single();
    if (!exam) throw new Error("No encontrado.");
    const { data: eqs } = await supabaseAdmin.from("exam_questions")
      .select("orden, snapshot, respuesta_dada, correcta, question_id")
      .eq("exam_id", data.examId).order("orden");
    const qIds = (eqs ?? []).map((e) => e.question_id);
    const { data: qs } = await supabaseAdmin.from("questions")
      .select("id, respuesta_correcta, topics(nombre)").in("id", qIds);
    const qMap = new Map((qs ?? []).map((q: any) => [q.id, q]));
    const preguntas = (eqs ?? []).map((e) => {
      const q: any = qMap.get(e.question_id);
      return {
        orden: e.orden,
        pregunta: (e.snapshot as any)?.pregunta,
        eliminatoria: (e.snapshot as any)?.eliminatoria,
        tema: q?.topics?.nombre ?? null,
        respuesta_dada: e.respuesta_dada,
        respuesta_correcta: q?.respuesta_correcta,
        correcta: e.correcta,
      };
    });
    return { exam, preguntas };
  });

export const firmarInspector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    examId: z.string().uuid(), firma: z.string().min(20),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ex } = await supabaseAdmin.from("exams").select("signature_aspirante, status").eq("id", data.examId).single();
    if (!ex) throw new Error("Examen no encontrado.");
    if (!ex.signature_aspirante) throw new Error("El aspirante todavía no firmó este examen.");
    if (!["aprobado","desaprobado"].includes(ex.status)) throw new Error("El examen no está finalizado.");
    const { error } = await supabaseAdmin.from("exams").update({
      signature_inspector: data.firma,
      signed_inspector_at: new Date().toISOString(),
    }).eq("id", data.examId);
    if (error) throw error;
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId, accion: "firmar_inspector", target_type: "exam", target_id: data.examId,
    });
    return { ok: true };
  });
