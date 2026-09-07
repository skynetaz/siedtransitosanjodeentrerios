// Sirve las señales subidas por el personal desde el almacenamiento privado.
// Público (solo lectura de imágenes): las señales deben verse en el examen,
// en la vista de impresión y en el PDF exportado.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/senal/$name")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const name = String((params as { name?: string }).name ?? "");
        if (!name || name.includes("/") || name.includes("..")) {
          return new Response("Nombre inválido", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("senales").download(name);
        if (error || !data) return new Response("No encontrada", { status: 404 });
        return new Response(await data.arrayBuffer(), {
          headers: {
            "content-type": data.type || "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
