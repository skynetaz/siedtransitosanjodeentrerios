// Server functions para operaciones administrativas.
// Todo lo que requiera el service role (crear usuarios, resetear contraseñas)
// se ejecuta acá. Otras lecturas/escrituras normales usan RLS desde el cliente.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------------------------------------------------------------
// Bootstrap: crear el primer administrador cuando no existe ninguno.
// No requiere autenticación previa.
// ---------------------------------------------------------------
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      nombre: z.string().min(1),
      apellido: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
    if (countErr) throw countErr;
    if ((count ?? 0) > 0) throw new Error("Ya existe un administrador registrado. Contactá al administrador para que te dé acceso.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nombre: data.nombre, apellido: data.apellido },
    });
    if (error) throw error;
    const uid = created.user.id;
    await supabaseAdmin.from("profiles").upsert({ id: uid, email: data.email, nombre: data.nombre, apellido: data.apellido });
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" });
    if (rErr) throw rErr;
    return { ok: true };
  });

// ---------------------------------------------------------------
// Crear staff (inspector o admin). Requiere admin.
// ---------------------------------------------------------------
export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      nombre: z.string().min(1),
      apellido: z.string().min(1),
      role: z.enum(["admin", "inspector"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores pueden crear personal.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { nombre: data.nombre, apellido: data.apellido },
    });
    if (error) throw error;
    const uid = created.user.id;
    await supabaseAdmin.from("profiles").upsert({ id: uid, email: data.email, nombre: data.nombre, apellido: data.apellido });
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    if (rErr) throw rErr;
    return { ok: true, user_id: uid };
  });

// ---------------------------------------------------------------
// Registrar aspirante. Admin o Inspector.
// Crea/actualiza usuario auth con email = <dni>@aspirante.local
// La contraseña inicial es un placeholder — se sobreescribe al habilitar examen.
// ---------------------------------------------------------------
export const registerAspirante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      dni: z.string().min(6).max(12),
      nombre: z.string().min(1),
      apellido: z.string().min(1),
      telefono: z.string().optional(),
      license_class: z.enum(["A","B","C","D","E","UNICA"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "inspector" });
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isStaff && !isAdmin) throw new Error("Sin permisos.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = `${data.dni}@aspirante.local`;
    // Buscar profile existente por DNI
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("dni", data.dni).maybeSingle();
    let uid = existing?.id;
    if (!uid) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email, password: cryptoRandomCode(12), email_confirm: true,
        user_metadata: { dni: data.dni, nombre: data.nombre, apellido: data.apellido, telefono: data.telefono, license_class: data.license_class },
      });
      if (error) throw error;
      uid = created.user.id;
      await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "aspirante" }).select();
    }
    await supabaseAdmin.from("profiles").upsert({
      id: uid, dni: data.dni, nombre: data.nombre, apellido: data.apellido, email,
      telefono: data.telefono ?? null, license_class: data.license_class,
    });
    return { ok: true, id: uid };
  });

// ---------------------------------------------------------------
// Habilitar examen: genera código de 6 dígitos, setea la contraseña
// del aspirante a ese código, crea exam_access_code y una fila de exams
// en estado 'habilitado'.
// ---------------------------------------------------------------
export const habilitarExamen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ aspiranteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isInsp } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "inspector" });
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isInsp && !isAdmin) throw new Error("Sin permisos.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar que el aspirante existe y su clase
    const { data: prof, error: pErr } = await supabaseAdmin.from("profiles").select("id, dni, license_class").eq("id", data.aspiranteId).maybeSingle();
    if (pErr) throw pErr;
    if (!prof || !prof.license_class) throw new Error("Aspirante sin clase de licencia asignada.");

    // Cancelar códigos abiertos previos del aspirante
    await supabaseAdmin.from("exam_access_codes").update({ status: "cancelado" }).eq("aspirante_id", data.aspiranteId).eq("status", "habilitado");
    // Cancelar exams en estado habilitado/esperando
    await supabaseAdmin.from("exams").update({ status: "cancelado" }).eq("aspirante_id", data.aspiranteId).in("status", ["habilitado","esperando"]);

    const code = cryptoRandomCode(6, true);
    // Actualizar contraseña
    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(data.aspiranteId, { password: code });
    if (pwErr) throw pwErr;

    const expires = new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(); // 4h
    const { error: cErr } = await supabaseAdmin.from("exam_access_codes").insert({
      aspirante_id: data.aspiranteId, inspector_id: context.userId, clase: prof.license_class,
      codigo: code, status: "habilitado", expires_at: expires,
    });
    if (cErr) throw cErr;
    const { data: ex, error: eErr } = await supabaseAdmin.from("exams").insert({
      aspirante_id: data.aspiranteId, inspector_id: context.userId, clase: prof.license_class,
      status: "habilitado",
    }).select().single();
    if (eErr) throw eErr;
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId, accion: "habilitar_examen", target_type: "exam", target_id: ex.id,
      meta: { aspirante_id: data.aspiranteId, dni: prof.dni },
    });
    return { ok: true, code, exam_id: ex.id, dni: prof.dni };
  });

// ---------------------------------------------------------------
// Cancelar examen
// ---------------------------------------------------------------
export const cancelarExamen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isInsp } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "inspector" });
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isInsp && !isAdmin) throw new Error("Sin permisos.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("exams").update({ status: "cancelado", finished_at: new Date().toISOString() }).eq("id", data.examId);
    await supabaseAdmin.from("exam_access_codes").update({ status: "cancelado" }).eq("aspirante_id",
      (await supabaseAdmin.from("exams").select("aspirante_id").eq("id", data.examId).single()).data?.aspirante_id ?? "");
    return { ok: true };
  });

function cryptoRandomCode(len: number, digitsOnly = false): string {
  const chars = digitsOnly ? "0123456789" : "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}
