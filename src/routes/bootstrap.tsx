import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/bootstrap")({
  head: () => ({ meta: [{ title: "Registro deshabilitado — SIED" }, { name: "description", content: "Las cuentas las habilita únicamente el proveedor." }] }),
  component: () => (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <CardTitle>Registro deshabilitado</CardTitle>
          <CardDescription>Por seguridad, las cuentas de personal las crea únicamente el proveedor de la plataforma. <Link to="/auth" className="underline">Ir al ingreso</Link></CardDescription>
        </CardHeader>
      </Card>
    </div>
  ),
});
