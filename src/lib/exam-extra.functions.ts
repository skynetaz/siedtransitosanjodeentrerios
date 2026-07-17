// Extensiones al motor de examen del aspirante: confirmar datos previos
// y firmar el examen al finalizar.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const confirmarDatosPrevios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    examId: z.string().uuid(),
    datos: z.object({
      nombre: z.string().min(1),
      apellido: z.string().min(1),
      dni: z.string().min(6),
      email: z.string().email().optional().or(z.literal("")),
      telefono: z.string().optional(),
    }),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ex } = await supabaseAdmin.from("exams").select("aspirante_id, status").eq("id", data.examId).single();
    if (!ex || ex.aspirante_id !== context.userId) throw new Error("No autorizado.");
    if (!["habilitado","rindiendo"].includes(ex.status)) throw new Error("El examen no admite modificaciones.");
    await supabaseAdmin.from("exams").update({ datos_aspirante: data.datos }).eq("id", data.examId);
    await supabaseAdmin.from("profiles").update({
      nombre: data.datos.nombre, apellido: data.datos.apellido,
      email: data.datos.email || null, telefono: data.datos.telefono || null,
    }).eq("id", context.userId);
    return { ok: true };
  });

export const firmarAspirante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    examId: z.string().uuid(),
    firma: z.string().min(20),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ex } = await supabaseAdmin.from("exams").select("aspirante_id, status").eq("id", data.examId).single();
    if (!ex || ex.aspirante_id !== context.userId) throw new Error("No autorizado.");
    if (!["aprobado","desaprobado","finalizado"].includes(ex.status)) throw new Error("El examen no está finalizado.");
    await supabaseAdmin.from("exams").update({
      signature_aspirante: data.firma,
      signed_aspirante_at: new Date().toISOString(),
    }).eq("id", data.examId);
    return { ok: true };
  });
