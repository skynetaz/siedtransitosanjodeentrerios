// Ingreso al examen mediante DNI + código y motor de examen multiple choice.
// El aspirante nunca recibe la respuesta correcta desde el cliente.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { shuffle, buildOptions } from "@/lib/mc";

// ---------------------------------------------------------------
// Valida el código del aspirante autenticado y arranca el examen
// inmediatamente (sin pantallas intermedias).
// ---------------------------------------------------------------
export const iniciarConCodigo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ codigo: z.string().trim().min(4).max(12) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const codigo = data.codigo.toUpperCase();

    const { data: code } = await supabaseAdmin
      .from("exam_access_codes")
      .select("*")
      .eq("codigo", codigo)
      .maybeSingle();
    if (!code || code.aspirante_id !== context.userId) throw new Error("Código inválido.");
    if (code.status === "utilizado") throw new Error("Este código ya fue utilizado.");
    if (code.status === "cancelado") throw new Error("Este código fue cancelado.");
    if (code.expires_at && new Date(code.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("exam_access_codes").update({ status: "expirado" }).eq("id", code.id);
      throw new Error("El código venció. Pedí uno nuevo al administrador.");
    }

    const examId = code.exam_id;
    if (!examId) throw new Error("El código no tiene un examen asociado.");
    const { data: exam } = await supabaseAdmin.from("exams").select("*").eq("id", examId).single();
    if (!exam || exam.aspirante_id !== context.userId) throw new Error("Examen no disponible.");
    if (!["habilitado", "esperando"].includes(exam.status)) throw new Error("Este examen ya no está disponible.");

    const { data: cfg } = await supabaseAdmin.from("exam_configs").select("*").eq("clase", exam.clase).maybeSingle();
    const cantidad = cfg?.cantidad_preguntas ?? 20;
    const duracion = cfg?.duracion_minutos ?? 15;
    const maxErrores = cfg?.max_errores ?? 4;

    type Clase = "A" | "B" | "C" | "D" | "E" | "UNICA";
    const clases: Clase[] = exam.clase === "UNICA" ? ["UNICA"] : [exam.clase as Clase, "UNICA"];
    const { data: pool } = await supabaseAdmin
      .from("questions")
      .select("id, pregunta, eliminatoria, peso, respuesta_correcta, opciones_incorrectas")
      .in("clase", clases)
      .eq("activa", true);
    if (!pool || pool.length === 0) throw new Error("No hay preguntas disponibles para esta clase.");

    const selected = shuffle(pool).slice(0, Math.min(cantidad, pool.length));
    const now = new Date().toISOString();

    await supabaseAdmin.from("exam_questions").delete().eq("exam_id", examId);
    const { error: iErr } = await supabaseAdmin.from("exam_questions").insert(
      selected.map((q, i) => ({
        exam_id: examId,
        question_id: q.id,
        orden: i + 1,
        snapshot: {
          pregunta: q.pregunta,
          eliminatoria: q.eliminatoria,
          peso: q.peso,
          opciones: buildOptions(q.respuesta_correcta, q.opciones_incorrectas ?? []),
        },
      })),
    );
    if (iErr) throw iErr;

    await supabaseAdmin.from("exams").update({
      status: "rindiendo",
      started_at: now,
      total_preguntas: selected.length,
      codigo_utilizado: codigo,
      config_snapshot: { cantidad, duracion_minutos: duracion, max_errores: maxErrores },
    }).eq("id", examId);

    await supabaseAdmin.from("exam_access_codes")
      .update({ status: "utilizado", used_at: now })
      .eq("id", code.id);

    const { data: qs } = await supabaseAdmin
      .from("exam_questions")
      .select("id, orden, snapshot, respuesta_dada")
      .eq("exam_id", examId)
      .order("orden");
    const { data: updated } = await supabaseAdmin.from("exams").select("*").eq("id", examId).single();

    return { exam: updated, questions: qs ?? [] };
  });

// ---------------------------------------------------------------
// Registro de eventos de seguridad (pantalla completa, pestaña, recarga…)
// Si `finalizar` es true, cierra el examen indicando el motivo.
// ---------------------------------------------------------------
export const registrarEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      examId: z.string().uuid(),
      tipo: z.enum(["fullscreen_exit", "tab_change", "blur", "reload", "close", "warning"]),
      motivo: z.string().trim().max(200).optional(),
      finalizar: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam } = await supabaseAdmin
      .from("exams").select("id, aspirante_id, status, focus_lost_count, started_at")
      .eq("id", data.examId).single();
    if (!exam || exam.aspirante_id !== context.userId) return { ok: false };

    await supabaseAdmin.from("exam_events").insert({
      exam_id: exam.id, tipo: data.tipo, motivo: data.motivo ?? null,
    });
    await supabaseAdmin.from("exams")
      .update({ focus_lost_count: (exam.focus_lost_count ?? 0) + 1 })
      .eq("id", exam.id);

    if (data.finalizar && exam.status === "rindiendo") {
      const finished = new Date();
      const started = exam.started_at ? new Date(exam.started_at) : finished;
      await supabaseAdmin.from("exams").update({
        status: "cancelado",
        finished_at: finished.toISOString(),
        motivo_finalizacion: data.motivo ?? data.tipo,
        tiempo_utilizado_seg: Math.round((finished.getTime() - started.getTime()) / 1000),
      }).eq("id", exam.id);
      return { ok: true, cancelado: true };
    }
    return { ok: true, cancelado: false };
  });
