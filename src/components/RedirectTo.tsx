import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Redirección segura fuera de un panel protegido.
 * Hace una navegación completa (no del router) para evitar bucles de
 * redirección entre rutas anidadas cuando no hay sesión.
 */
export function RedirectTo({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
