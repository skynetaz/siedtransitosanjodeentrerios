import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCurrentRole } from "@/lib/use-current-user";
import { Loader2 } from "lucide-react";

// Ruta neutral post-login que redirige según rol
export const Route = createFileRoute("/panel")({ component: Redirector });

function Redirector() {
  const { loading, user, isAdmin, isInspector, isAspirante } = useCurrentRole();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (isInspector) return <Navigate to="/inspector" replace />;
  if (isAspirante) return <Navigate to="/aspirante" replace />;
  return <div className="min-h-screen flex items-center justify-center p-6 text-center text-muted-foreground">Tu cuenta aún no tiene un rol asignado. Contactá al administrador.</div>;
}
