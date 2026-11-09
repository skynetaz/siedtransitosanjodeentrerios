// Escáner inteligente: lee un examen en PDF, foto o texto y devuelve preguntas estructuradas.
// No guarda nada: el administrador revisa y confirma antes de incorporar.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PreguntaEscaneada = {
  clase: "A" | "B" | "C" | "D" | "E" | "UNICA";
  tema: string;
  pregunta: string;
  respuesta_correcta: string;
  opciones_incorrectas: string[];
  eliminatoria: boolean;
};

export const escanearDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    texto: z.string().max(200_000).optional(),
    archivoBase64: z.string().max(14_000_000).optional(),
    mime: z.string().max(100).optional(),
    nombre: z.string().max(200).optional(),
    claseSugerida: z.enum(["A", "B", "C", "D", "E", "UNICA", "AUTO"]).default("AUTO"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores.");
    if (!data.texto && !data.archivoBase64) throw new Error("Subí un archivo o pegá el texto.");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Falta la clave de IA.");

    const instrucciones = [
      "Sos un experto en exámenes teóricos de licencias de conducir de Argentina (Ley 24.449).",
      "Del documento, extraé TODAS las preguntas de opción múltiple.",
      "Detectá la respuesta correcta (marcada con X, tilde, asterisco, negrita, subrayado o una clave de respuestas).",
      "Si no está marcada, deducila según la ley y la normativa vigente.",
      "Completá hasta 3 opciones incorrectas: usá las del documento y, si faltan, inventá distractores verosímiles.",
      "Quitá las letras/números de las opciones (a), b), 1.). Corregí ortografía sin cambiar el sentido.",
      data.claseSugerida === "AUTO"
        ? "Clase: A=motos, B=autos, C=camiones, D=transporte de pasajeros, E=maquinaria/articulados, UNICA=general o común a todas."
        : `Asigná la clase ${data.claseSugerida} a todas.`,
      "Tema: una o dos palabras (ej: Señales, Prioridades, Velocidades, Alcohol, Documentación, Primeros auxilios, Mecánica).",
      "eliminatoria=true solo para alcohol, semáforo en rojo, prioridad de peatones, cinturón/casco o velocidad máxima.",
      'Devolvé SOLO JSON: {"items":[{"clase":"B","tema":"...","pregunta":"...","respuesta_correcta":"...","opciones_incorrectas":["...","...","..."],"eliminatoria":false}]}',
    ].join("\n");

    const content: any[] = [{ type: "text", text: instrucciones }];
    if (data.texto) content.push({ type: "text", text: "DOCUMENTO:\n" + data.texto });
    if (data.archivoBase64 && data.mime) {
      const url = `data:${data.mime};base64,${data.archivoBase64}`;
      if (data.mime.startsWith("image/")) content.push({ type: "image_url", image_url: { url } });
      else content.push({ type: "file", file: { filename: data.nombre ?? "examen.pdf", file_data: url } });
    }

    { const { consumirCupoIA } = await import("./ia-cupo.server"); await consumirCupoIA(context); }
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("Límite de uso de IA alcanzado. Probá en unos minutos.");
    if (res.status === 402) throw new Error("Se agotaron los créditos de IA del espacio de trabajo.");
    if (!res.ok) {
      console.error("escaneo IA", res.status, await res.text().catch(() => ""));
      throw new Error("No se pudo leer el documento. Probá con otro formato o una foto más nítida.");
    }
    const json: any = await res.json();
    let raw = String(json.choices?.[0]?.message?.content ?? "{}").trim().replace(/^```(json)?/i, "").replace(/```$/, "");
    let parsed: { items?: any[] } = {};
    try { parsed = JSON.parse(raw); } catch { throw new Error("La IA devolvió un formato inesperado. Intentá de nuevo."); }
    const clases = ["A", "B", "C", "D", "E", "UNICA"];
    const items: PreguntaEscaneada[] = (parsed.items ?? [])
      .map((it: any) => ({
        clase: clases.includes(it.clase) ? it.clase : "UNICA",
        tema: String(it.tema ?? "General").trim().slice(0, 60) || "General",
        pregunta: String(it.pregunta ?? "").trim(),
        respuesta_correcta: String(it.respuesta_correcta ?? "").trim(),
        opciones_incorrectas: (Array.isArray(it.opciones_incorrectas) ? it.opciones_incorrectas : [])
          .map((o: any) => String(o).trim()).filter(Boolean).slice(0, 3),
        eliminatoria: it.eliminatoria === true,
      }))
      .filter((it: PreguntaEscaneada) => it.pregunta.length >= 3 && it.respuesta_correcta.length >= 1);
    return { items };
  });
