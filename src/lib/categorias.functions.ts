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
