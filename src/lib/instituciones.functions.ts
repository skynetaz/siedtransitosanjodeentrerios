// Herramientas del dueño de la plataforma (IA Triunfar) para operar cada municipio.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwner(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_platform_owner", { _uid: context.userId });
  if (!data) throw new Error("Solo el dueño de la plataforma.");
}

/** Cambia el municipio en el que trabaja el dueño de la plataforma. */
export const activarInstitucion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ institucionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("institucion_miembros")
      .upsert({ user_id: context.userId, institucion_id: data.institucionId });
    if (error) throw error;
    return { ok: true };
  });

/** Crea el administrador de un municipio, vinculado solo a ese municipio. */
export const crearAdminInstitucion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    institucionId: z.string().uuid(),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(72),
    nombre: z.string().trim().min(1).max(80),
    apellido: z.string().trim().min(1).max(80),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { nombre: data.nombre, apellido: data.apellido },
    });
    if (error) throw new Error(error.message.includes("already") ? "Ese correo ya tiene una cuenta." : error.message);
    const uid = created.user.id;
    await supabaseAdmin.from("profiles").upsert({ id: uid, email: data.email, nombre: data.nombre, apellido: data.apellido });
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" });
    const { error: mErr } = await supabaseAdmin.from("institucion_miembros").upsert({ user_id: uid, institucion_id: data.institucionId });
    if (mErr) throw mErr;
    return { ok: true };
  });

/** Copia al municipio el banco de preguntas y las categorías base de la institución principal. */
export const cargarPlantillaBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ institucionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: principal } = await supabaseAdmin.from("instituciones").select("id").eq("es_principal", true).single();
    if (!principal || principal.id === data.institucionId) throw new Error("Elegí un municipio distinto del principal.");
    const { count } = await supabaseAdmin.from("questions").select("id", { count: "exact", head: true }).eq("institucion_id", data.institucionId);
    if ((count ?? 0) > 0) throw new Error("Este municipio ya tiene preguntas cargadas.");

    const { data: qs, error } = await supabaseAdmin.from("questions")
      .select("clase, topic_id, pregunta, respuesta_correcta, respuestas_aceptadas, eliminatoria, peso, nivel, opciones_incorrectas, opciones_revisadas, orden")
      .eq("institucion_id", principal.id).eq("activa", true);
    if (error) throw error;
    const rows = (qs ?? []).map((q) => ({ ...q, activa: true, fuente: "plantilla base", institucion_id: data.institucionId }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error: e } = await supabaseAdmin.from("questions").insert(rows.slice(i, i + 500));
      if (e) throw e;
    }
    const suf = data.institucionId.slice(0, 6);
    const { data: cats } = await supabaseAdmin.from("exam_categories").select("*").eq("institucion_id", principal.id);
    const nuevas = (cats ?? []).map((c: any) => {
      const { created_at, updated_at, ...rest } = c;
      return { ...rest, slug: `${c.slug}-${suf}`, institucion_id: data.institucionId };
    });
    if (nuevas.length) await supabaseAdmin.from("exam_categories").upsert(nuevas, { onConflict: "slug", ignoreDuplicates: true });
    return { preguntas: rows.length, categorias: nuevas.length };
  });
