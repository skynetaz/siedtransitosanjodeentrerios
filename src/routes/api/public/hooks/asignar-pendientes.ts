import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/hooks/asignar-pendientes")({
  server: { handlers: { POST: async ({ request }) => {
    const secret = process.env["TURNOS_HOOK_SECRET"];
    const auth = request.headers.get("authorization") ?? "";
    if (!secret || auth !== `Bearer ${secret}`) return new Response("No autorizado", { status: 401 });
    const { asignarPendientes } = await import("@/lib/turnos.server");
    return Response.json({ procesados: await asignarPendientes() });
  } } },
});
