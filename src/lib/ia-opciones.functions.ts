// Generación asistida por IA de las opciones incorrectas (distractores)
// del banco de preguntas. Siempre queda un borrador que el administrador
// revisa y confirma desde el panel.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Solo administradores.");
}

export const generarOpcionesIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      clase: z.enum(["A", "B", "C", "D", "E", "UNICA", "TODAS"]).default("TODAS"),
      limite: z.number().int().min(1).max(40).default(15),
      soloFaltantes: z.boolean().default(true),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Falta la clave de IA.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("questions")
      .select("id, pregunta, respuesta_correcta, opciones_incorrectas, clase")
      .eq("activa", true)
      .limit(data.limite);
    if (data.clase !== "TODAS") q = q.eq("clase", data.clase);
    if (data.soloFaltantes) q = q.eq("opciones_revisadas", false);
    const { data: rows, error } = await q;
    if (error) throw error;
    const pendientes = (rows ?? []).filter((r) => !data.soloFaltantes || (r.opciones_incorrectas ?? []).length < 3);
    if (pendientes.length === 0) return { generadas: 0 };

    const prompt = [
      "Sos un experto en normativa de tránsito argentina (Ley 24.449).",
      "Para cada pregunta te doy la respuesta correcta. Generá EXACTAMENTE 3 opciones incorrectas",
      "plausibles, breves (máximo 90 caracteres), en español rioplatense, sin numerar y claramente falsas",
      "para alguien que estudió, pero verosímiles. No repitas la respuesta correcta.",
      "Devolvé SOLO un JSON con la forma {\"items\":[{\"id\":\"...\",\"opciones\":[\"a\",\"b\",\"c\"]}]}",
      "",
      JSON.stringify(pendientes.map((p) => ({ id: p.id, pregunta: p.pregunta, correcta: p.respuesta_correcta }))),
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("Límite de uso de IA alcanzado. Probá en unos minutos.");
    if (res.status === 402) throw new Error("Se agotaron los créditos de IA del espacio de trabajo.");
    if (!res.ok) throw new Error("No se pudieron generar las opciones.");
    const json: any = await res.json();
    let parsed: { items?: { id: string; opciones: string[] }[] } = {};
    try {
      parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    } catch {
      throw new Error("La IA devolvió un formato inesperado.");
    }

    let generadas = 0;
    for (const item of parsed.items ?? []) {
      const opciones = (item.opciones ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 3);
      if (opciones.length < 2) continue;
      const { error: uErr } = await supabaseAdmin
        .from("questions")
        .update({ opciones_incorrectas: opciones, opciones_revisadas: false })
        .eq("id", item.id);
      if (!uErr) generadas++;
    }
    return { generadas };
  });
