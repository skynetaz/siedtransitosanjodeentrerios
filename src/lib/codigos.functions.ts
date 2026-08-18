// Módulo de códigos de examen (admin / inspector).
// Un código es único, de un solo uso, vence a los 15 minutos y queda
// asociado a un DNI, a un examen y a la fecha/hora de generación.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CODE_TTL_MIN = 15;

function randomCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i]! % chars.length];
  return out;
}

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: ok } = await context.supabase.rpc("current_role_any", { _roles: ["admin", "inspector"] });
  if (!ok) throw new Error("Sin permisos.");
}

/** Marca como expirados los códigos disponibles cuya vigencia venció. */
async function expirarVencidos(admin: any) {
  await admin
    .from("exam_access_codes")
    .update({ status: "expirado" })
    .eq("status", "disponible")
    .lt("expires_at", new Date().toISOString());
}

// ---------------------------------------------------------------
// Generar código para un DNI (crea el aspirante si no existe)
// ---------------------------------------------------------------
export const generarCodigo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      dni: z.string().trim().min(6).max(12),
      nombre: z.string().trim().min(1).max(80),
      apellido: z.string().trim().min(1).max(80),
      email: z.string().trim().email().max(255).optional().or(z.literal("")),
      telefono: z.string().trim().max(40).optional().or(z.literal("")),
      categoria: z.string().trim().min(1),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolverCategoria } = await import("@/lib/seleccion.server");
    await expirarVencidos(supabaseAdmin);
    const cat = await resolverCategoria(supabaseAdmin, data.categoria, "UNICA");
    const clase = (cat.clases.find((c) => c !== "UNICA") ?? "UNICA") as "A"|"B"|"C"|"D"|"E"|"UNICA";

    const loginEmail = `${data.dni}@aspirante.local`;
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("dni", data.dni).maybeSingle();
    let uid = existing?.id as string | undefined;
    if (!uid) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: loginEmail,
        password: randomCode(12),
        email_confirm: true,
        user_metadata: { dni: data.dni, nombre: data.nombre, apellido: data.apellido },
      });
      if (error) throw error;
      uid = created.user.id;
      await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "aspirante" });
    }
    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      dni: data.dni,
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email || loginEmail,
      telefono: data.telefono || null,
      license_class: clase,
    });

    // Un solo código vigente por aspirante
    await supabaseAdmin.from("exam_access_codes").update({ status: "cancelado" })
      .eq("aspirante_id", uid).eq("status", "disponible");
    await supabaseAdmin.from("exams").update({ status: "cancelado" })
      .eq("aspirante_id", uid).in("status", ["habilitado", "esperando", "rindiendo"]);

    // Código único
    let codigo = randomCode(6);
    for (let i = 0; i < 5; i++) {
      const { data: dup } = await supabaseAdmin.from("exam_access_codes").select("id").eq("codigo", codigo).maybeSingle();
      if (!dup) break;
      codigo = randomCode(6);
    }

    // El código es también la contraseña de acceso del aspirante
    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(uid, { password: codigo });
    if (pwErr) throw pwErr;

    const { data: exam, error: exErr } = await supabaseAdmin.from("exams").insert({
      aspirante_id: uid,
      inspector_id: context.userId,
      clase,
      categoria_slug: cat.slug,
      clases_incluidas: cat.clases,
      status: "habilitado",
      codigo_utilizado: codigo,
      datos_aspirante: {
        nombre: data.nombre, apellido: data.apellido, dni: data.dni,
        email: data.email || "", telefono: data.telefono || "",
      },
    }).select("id").single();
    if (exErr) throw exErr;

    const expires_at = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();
    const { data: row, error: cErr } = await supabaseAdmin.from("exam_access_codes").insert({
      aspirante_id: uid, inspector_id: context.userId, created_by: context.userId,
      clase, categoria_slug: cat.slug, clases_incluidas: cat.clases,
      codigo, dni: data.dni, status: "disponible",
      expires_at, exam_id: exam.id,
    }).select("*").single();
    if (cErr) throw cErr;

    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId, accion: "generar_codigo", target_type: "exam", target_id: exam.id,
      meta: { dni: data.dni, categoria: cat.slug },
    });

    return { codigo, expires_at, exam_id: exam.id, id: row.id, aspirante_id: uid, categoria: cat.nombre };
  });

// ---------------------------------------------------------------
// Listado de códigos
// ---------------------------------------------------------------
export const listarCodigos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      estado: z.enum(["todos", "disponible", "utilizado", "cancelado", "expirado"]).default("todos"),
      busqueda: z.string().trim().max(80).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await expirarVencidos(supabaseAdmin);
    let q = supabaseAdmin
      .from("exam_access_codes")
      .select("id, codigo, dni, clase, categoria_slug, status, created_at, expires_at, used_at, exam_id, aspirante_id, profiles!exam_access_codes_aspirante_id_fkey(nombre, apellido)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.estado !== "todos") q = q.eq("status", data.estado);
    if (data.busqueda) q = q.or(`dni.ilike.%${data.busqueda}%,codigo.ilike.%${data.busqueda}%`);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []).map((r: any) => ({
      id: r.id, codigo: r.codigo, dni: r.dni, clase: r.clase, categoria_slug: r.categoria_slug, status: r.status,
      created_at: r.created_at, expires_at: r.expires_at, used_at: r.used_at,
      exam_id: r.exam_id,
      nombre: [r.profiles?.nombre, r.profiles?.apellido].filter(Boolean).join(" ") || "—",
    }));
  });

// ---------------------------------------------------------------
// Cancelar / eliminar
// ---------------------------------------------------------------
export const cancelarCodigo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("exam_access_codes").select("exam_id, status").eq("id", data.id).single();
    if (row?.status === "utilizado") throw new Error("El código ya fue utilizado.");
    await supabaseAdmin.from("exam_access_codes").update({ status: "cancelado" }).eq("id", data.id);
    if (row?.exam_id) {
      await supabaseAdmin.from("exams").update({ status: "cancelado", motivo_finalizacion: "código cancelado" })
        .eq("id", row.exam_id).in("status", ["habilitado", "esperando"]);
    }
    return { ok: true };
  });

export const eliminarCodigo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores pueden eliminar códigos.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("exam_access_codes").delete().eq("id", data.id);
    return { ok: true };
  });
