// Importador masivo de preguntas desde JSON.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const itemSchema = z.object({
  clase: z.enum(["A","B","C","D","E","UNICA"]),
  tema: z.string().min(1),
  pregunta: z.string().min(3),
  respuesta_correcta: z.string().min(1),
  respuestas_aceptadas: z.array(z.string()).optional().default([]),
  eliminatoria: z.boolean().optional().default(false),
  activa: z.boolean().optional().default(true),
  peso: z.number().int().min(1).max(10).optional().default(1),
  nivel: z.enum(["facil","medio","dificil"]).optional().default("medio"),
});

export const importarPreguntas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    items: z.array(itemSchema).min(1).max(2000),
    reemplazarPorClase: z.boolean().optional().default(false),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.reemplazarPorClase) {
      const clases = [...new Set(data.items.map((i) => i.clase))] as ("A"|"B"|"C"|"D"|"E"|"UNICA")[];
      await supabaseAdmin.from("questions").update({ activa: false }).in("clase", clases);
    }

    const nombres = [...new Set(data.items.map((i) => i.tema.trim()))];
    const { data: existing } = await supabaseAdmin.from("topics").select("id, nombre").in("nombre", nombres);
    const map = new Map<string, string>((existing ?? []).map((t: any) => [t.nombre, t.id]));
    const faltantes = nombres.filter((n) => !map.has(n));
    if (faltantes.length) {
      const nuevos = faltantes.map((n) => ({ nombre: n, slug: n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }));
      const { data: ins } = await supabaseAdmin.from("topics").insert(nuevos).select("id, nombre");
      (ins ?? []).forEach((t: any) => map.set(t.nombre, t.id));
    }

    const rows = data.items.map((it) => ({
      clase: it.clase, topic_id: map.get(it.tema.trim())!, pregunta: it.pregunta,
      respuesta_correcta: it.respuesta_correcta,
      respuestas_aceptadas: it.respuestas_aceptadas,
      eliminatoria: it.eliminatoria, activa: it.activa,
      peso: it.peso, nivel: it.nivel,
    }));
    const { error, count } = await supabaseAdmin.from("questions").insert(rows, { count: "exact" });
    if (error) throw error;
    return { ok: true, insertadas: count ?? rows.length };
  });
