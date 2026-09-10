// Categorías de examen: principiante / anexo-caduco, particulares y
// profesionales. Cada categoría define qué clases entran en un único examen.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listarCategorias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("exam_categories")
      .select("*")
      .order("orden", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

const categoriaSchema = z.object({
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/, "Usá minúsculas, números y guiones."),
  nombre: z.string().trim().min(2).max(120),
  tipo: z.enum(["principiante", "anexo_caduco"]),
  grupo: z.enum(["particular", "profesional"]),
  clases: z.array(z.enum(["A", "B", "C", "D", "E", "UNICA"])).min(1),
  incluye_senales: z.boolean().default(true),
  preguntas_senales: z.number().int().min(0).max(30).default(5),
  cantidad_preguntas: z.number().int().min(1).max(80).default(20),
  duracion_minutos: z.number().int().min(1).max(180).default(15),
  max_errores: z.number().int().min(0).max(40).default(4),
  activa: z.boolean().default(true),
  orden: z.number().int().min(0).max(9999).default(0),
});

export const guardarCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => categoriaSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("exam_categories").upsert(data as any);
    if (error) throw error;
    return { ok: true };
  });

export const eliminarCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ slug: z.string().trim().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("exam_categories").delete().eq("slug", data.slug);
    if (error) throw error;
    return { ok: true };
  });

const SELECT_PREGUNTA =
  "id, pregunta, clase, eliminatoria, peso, activa, respuesta_correcta, opciones_incorrectas, topic_id, topics(nombre)";

const mapPregunta = (q: any, orden: number, buildOptions: (c: string, i: string[]) => string[]) => ({
  orden,
  id: q.id as string,
  clase: q.clase as string,
  tema: (q.topics?.nombre as string) ?? null,
  pregunta: q.pregunta as string,
  eliminatoria: !!q.eliminatoria,
  activa: q.activa !== false,
  peso: (q.peso ?? 1) as number,
  correcta: q.respuesta_correcta as string,
  opciones: buildOptions(q.respuesta_correcta, q.opciones_incorrectas ?? []),
});

/** Ids de las preguntas elegidas a mano para una categoría (vacío = automático). */
export const listarPreguntasCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ slug: z.string().trim().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("exam_category_questions")
      .select("question_id, orden")
      .eq("categoria_slug", data.slug)
      .order("orden", { ascending: true });
    if (error) throw error;
    return (rows ?? []).map((r) => r.question_id as string);
  });

/** Reemplaza la selección propia de UNA categoría. No toca otras categorías. */
export const guardarPreguntasCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ slug: z.string().trim().min(1), ids: z.array(z.string().uuid()).max(200) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: dErr } = await supabaseAdmin
      .from("exam_category_questions")
      .delete()
      .eq("categoria_slug", data.slug);
    if (dErr) throw dErr;

    const ids = Array.from(new Set(data.ids));
    if (ids.length > 0) {
      const rows = ids.map((question_id, i) => ({ categoria_slug: data.slug, question_id, orden: i + 1 }));
      const { error: iErr } = await supabaseAdmin.from("exam_category_questions").insert(rows);
      if (iErr) throw iErr;
    }
    return { ok: true, total: ids.length };
  });

/** Banco de preguntas para el buscador del editor de categorías. */
export const listarBancoPreguntas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        clases: z.array(z.enum(["A", "B", "C", "D", "E", "UNICA"])).default([]),
        topicId: z.string().uuid().nullish(),
        texto: z.string().trim().max(200).default(""),
        soloActivas: z.boolean().default(true),
        limite: z.number().int().min(1).max(500).default(300),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildOptions } = await import("@/lib/mc");

    let q = supabaseAdmin.from("questions").select(SELECT_PREGUNTA).order("orden").limit(data.limite);
    if (data.clases.length > 0) q = q.in("clase", data.clases);
    if (data.topicId) q = q.eq("topic_id", data.topicId);
    if (data.soloActivas) q = q.eq("activa", true);
    if (data.texto) q = q.ilike("pregunta", `%${data.texto}%`);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []).map((r: any, i: number) => mapPregunta(r, i + 1, buildOptions));
  });

/** Temas disponibles (para filtrar el banco). */
export const listarTemas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("topics").select("id, nombre, slug").order("nombre");
    if (error) throw error;
    return data ?? [];
  });

/** Vista previa: arma un examen de muestra con la configuración indicada. */
export const previsualizarCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    categoriaSchema.partial({ slug: true, nombre: true }).extend({ ids: z.array(z.string().uuid()).nullish() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildOptions, shuffle } = await import("@/lib/mc");

    // Selección explícita (edición en curso) o guardada para esta categoría.
    let idsFijos: string[] | null = data.ids ?? null;
    if (!idsFijos && data.slug) {
      const { data: rows } = await supabaseAdmin
        .from("exam_category_questions")
        .select("question_id, orden")
        .eq("categoria_slug", data.slug)
        .order("orden", { ascending: true });
      if (rows && rows.length > 0) idsFijos = rows.map((r) => r.question_id as string);
    }

    if (idsFijos && idsFijos.length > 0) {
      const { data: rows } = await supabaseAdmin.from("questions").select(SELECT_PREGUNTA).in("id", idsFijos);
      const byId = new Map((rows ?? []).map((r: any) => [r.id as string, r]));
      const preguntasSel = idsFijos
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((q: any, i: number) => mapPregunta(q, i + 1, buildOptions));
      const senalTopic = await supabaseAdmin.from("topics").select("id").eq("slug", "senales").maybeSingle();
      const senalesIncluidas = (rows ?? []).filter((r: any) => r.topic_id === senalTopic.data?.id).length;
      return {
        modo: "manual" as const,
        disponibles: preguntasSel.length,
        solicitadas: preguntasSel.length,
        senalesIncluidas,
        puntaje: preguntasSel.reduce((s, q) => s + q.peso, 0),
        eliminatorias: preguntasSel.filter((q) => q.eliminatoria).length,
        preguntas: preguntasSel,
      };
    }

    const clases = (data.clases.length ? data.clases : ["UNICA"]) as ("A"|"B"|"C"|"D"|"E"|"UNICA")[];
    const { data: pool } = await supabaseAdmin
      .from("questions")
      .select(SELECT_PREGUNTA)
      .in("clase", clases)
      .eq("activa", true);
    const preguntas = (pool ?? []) as any[];

    let senales: any[] = [];
    let senalesIds = new Set<string>();
    if (data.incluye_senales && data.preguntas_senales > 0) {
      const { data: topic } = await supabaseAdmin.from("topics").select("id").eq("slug", "senales").maybeSingle();
      if (topic?.id) {
        senales = shuffle(preguntas.filter((q) => q.topic_id === topic.id)).slice(0, data.preguntas_senales);
        senalesIds = new Set(senales.map((q) => q.id));
      }
    }
    const resto = shuffle(preguntas.filter((q) => !senalesIds.has(q.id)));
    const faltan = Math.max(0, data.cantidad_preguntas - senales.length);
    const seleccion = shuffle([...senales, ...resto.slice(0, faltan)]);

    return {
      modo: "automatico" as const,
      disponibles: preguntas.length,
      solicitadas: data.cantidad_preguntas,
      senalesIncluidas: senales.length,
      puntaje: seleccion.reduce((s, q) => s + (q.peso ?? 1), 0),
      eliminatorias: seleccion.filter((q) => q.eliminatoria).length,
      preguntas: seleccion.map((q, i) => mapPregunta(q, i + 1, buildOptions)),
    };
  });
