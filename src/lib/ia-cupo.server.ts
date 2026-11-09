// Limitador de consumo de IA por institución: se verifica ANTES de llamar al modelo.
import { cupoIA } from "./planes";

export async function consumirCupoIA(context: { supabase: any; userId: string }) {
  const { data: owner } = await context.supabase.rpc("is_platform_owner", { _uid: context.userId });
  const { data: instId } = await context.supabase.rpc("current_institucion");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: inst } = await supabaseAdmin.from("instituciones").select("plan, estado, ia_cupo_mensual").eq("id", instId).maybeSingle();
  if (!inst) throw new Error("Institución no encontrada.");
  const periodo = new Date().toISOString().slice(0, 7);
  const { data: uso } = await supabaseAdmin.from("ia_uso").select("usos").eq("institucion_id", instId).eq("periodo", periodo).maybeSingle();
  const usados = uso?.usos ?? 0;
  const tope = cupoIA(inst.plan, inst.estado, inst.ia_cupo_mensual);
  if (!owner && usados >= tope) {
    throw new Error(`Has alcanzado el límite mensual de consultas de IA de tu plan (${usados}/${tope}). Contactá a IA Triunfar para ampliar tu cupo.`);
  }
  await supabaseAdmin.from("ia_uso").upsert({ institucion_id: instId, periodo, usos: usados + 1 });
}
