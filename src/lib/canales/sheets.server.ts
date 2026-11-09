import { z } from "zod";
const Resp = z.object({ ok: z.boolean(), error: z.string().optional() }).passthrough();
export async function llamarHoja(accion: string, datos: Record<string, unknown> = {}) {
  const url = process.env["SHEETS_WEBHOOK_URL"]; const token = process.env["SHEETS_WEBHOOK_SECRET"];
  if (!url || !token) return { ok: false, error: "La hoja de Google todavía no está conectada." } as any;
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, redirect: "follow", signal: ctrl.signal, body: JSON.stringify({ token, accion, ...datos }) });
    const txt = await r.text();
    try { return Resp.parse(JSON.parse(txt)) as any; } catch { return { ok: false, error: `Respuesta inválida de la hoja (HTTP ${r.status})` } as any; }
  } catch (e) { return { ok: false, error: (e as Error).name === "AbortError" ? "La hoja no respondió a tiempo" : "No se pudo conectar con la hoja" } as any; }
  finally { clearTimeout(to); }
}
