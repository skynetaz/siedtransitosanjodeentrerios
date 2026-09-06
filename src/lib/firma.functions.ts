// Firma guardada del personal (admin/inspector). Se registra una vez y luego
// se puede aplicar con un toque en cada examen, o editarla cuando haga falta.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMiFirma = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles").select("signature").eq("id", context.userId).maybeSingle();
    if (error) throw error;
    return { firma: (data?.signature as string | null) ?? null };
  });

export const guardarMiFirma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ firma: z.string().min(20) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles").update({ signature: data.firma }).eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const borrarMiFirma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles").update({ signature: null }).eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
