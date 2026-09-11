// Encuesta corta de experiencia al finalizar el examen + lectura para el panel.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertStaff(context: any) {
  const [{ data: a }, { data: i }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "inspector" }),
  ]);
  if (!a && !i) throw new Error("Sin permisos.");
}

export const ETIQUETAS_ENCUESTA = [
  "Todo claro",
  "Letra chica",
  "Se trabó",
  "Faltó tiempo",
  "Difícil de entender",
  "Muy rápido y simple",
] as const;

export const enviarFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    examId: z.string().uuid(),
    facilidad: z.number().int().min(1).max(5),
    comodidad: z.enum(["comodo", "normal", "incomodo"]),
    etiquetas: z.array(z.string().max(40)).max(6).default([]),
    comentario: z.string().max(500).optional().or(z.literal("")),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ex } = await supabaseAdmin
      .from("exams").select("id, aspirante_id").eq("id", data.examId).single();
    if (!ex || ex.aspirante_id !== context.userId) throw new Error("No autorizado.");

    const { error } = await supabaseAdmin.from("exam_feedback").insert({
      exam_id: data.examId,
      aspirante_id: context.userId,
      facilidad: data.facilidad,
      comodidad: data.comodidad,
      etiquetas: data.etiquetas,
      comentario: data.comentario ? data.comentario.trim() : null,
    });
    // Una sola respuesta por examen: si ya existe, no es un error para el aspirante.
    if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export type OpinionRow = {
  id: string;
  created_at: string;
  facilidad: number;
  comodidad: string;
  etiquetas: string[];
  comentario: string | null;
  sentimiento: "positivo" | "neutro" | "negativo";
  aspirante: string;
  dni: string;
  examen: string;
  resultado: string;
};

export const listarFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("exam_feedback")
      .select("id, created_at, facilidad, comodidad, etiquetas, comentario, exam_id, exams(status, categoria_slug, clases_incluidas, config_snapshot, datos_aspirante, profiles!exams_aspirante_id_fkey(nombre,apellido,dni))")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const slugs = Array.from(new Set((data ?? []).map((r: any) => r.exams?.categoria_slug).filter(Boolean)));
    const nombres = new Map<string, string>();
    if (slugs.length) {
      const { data: cats } = await supabaseAdmin.from("exam_categories").select("slug, nombre").in("slug", slugs);
      for (const c of cats ?? []) nombres.set(c.slug, c.nombre);
    }

    const filas: OpinionRow[] = (data ?? []).map((r: any) => {
      const ex = r.exams ?? {};
      const p = ex.profiles ?? {};
      const d = ex.datos_aspirante ?? {};
      const nombre = [p.apellido || d.apellido, p.nombre || d.nombre].filter(Boolean).join(", ");
      return {
        id: r.id,
        created_at: r.created_at,
        facilidad: r.facilidad,
        comodidad: r.comodidad,
        etiquetas: r.etiquetas ?? [],
        comentario: r.comentario,
        sentimiento: r.facilidad >= 4 ? "positivo" : r.facilidad === 3 ? "neutro" : "negativo",
        aspirante: nombre || "Aspirante",
        dni: p.dni || d.dni || "",
        examen: (ex.categoria_slug && nombres.get(ex.categoria_slug)) || ex.config_snapshot?.nombre || ex.categoria_slug || "—",
        resultado: ex.status ?? "—",
      };
    });

    const total = filas.length;
    const prom = (n: number[]) => (n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0);
    const comodidadValor: Record<string, number> = { comodo: 3, normal: 2, incomodo: 1 };
    const distribucion = [1, 2, 3, 4, 5].map((v) => ({ estrellas: v, cantidad: filas.filter((f) => f.facilidad === v).length }));
    const etiquetas = new Map<string, number>();
    for (const f of filas) for (const t of f.etiquetas) etiquetas.set(t, (etiquetas.get(t) ?? 0) + 1);

    return {
      filas,
      resumen: {
        total,
        facilidad: Number(prom(filas.map((f) => f.facilidad)).toFixed(2)),
        comodidad: Number(prom(filas.map((f) => comodidadValor[f.comodidad] ?? 2)).toFixed(2)),
        positivos: filas.filter((f) => f.sentimiento === "positivo").length,
        neutros: filas.filter((f) => f.sentimiento === "neutro").length,
        negativos: filas.filter((f) => f.sentimiento === "negativo").length,
        distribucion,
        etiquetas: Array.from(etiquetas.entries()).map(([texto, cantidad]) => ({ texto, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad),
      },
    };
  });
