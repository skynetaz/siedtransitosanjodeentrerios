import { createFileRoute, Link, Navigate, Outlet, useLocation } from "@tanstack/react-router";
import { useCurrentRole } from "@/lib/use-current-user";
import { AppShell } from "@/components/AppShell";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

const tabs = [
  { to: "/admin", label: "Inicio", exact: true },
  { to: "/admin/preguntas", label: "Banco de preguntas" },
  { to: "/admin/codigos", label: "Códigos" },
  { to: "/admin/categorias", label: "Categorías" },
  { to: "/admin/senales", label: "Señales" },
  { to: "/admin/importar", label: "Importar" },
  { to: "/admin/emulador", label: "Emulador" },
  { to: "/admin/archivo", label: "Archivo" },
  { to: "/admin/usuarios", label: "Usuarios" },
  { to: "/admin/configuracion", label: "Configuración" },
  { to: "/admin/estadisticas", label: "Estadísticas" },
];

function AdminLayout() {
  const { loading, user, isAdmin } = useCurrentRole();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/panel" replace />;
  return (
    <AppShell
      title="Panel Administrador"
      subtitle="Gestión completa del sistema de evaluación"
      nav={
        <nav className="hidden md:flex items-center gap-1">
          {tabs.map((t) => {
            const active = t.exact ? location.pathname === t.to : location.pathname.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={cn("px-3 py-1.5 rounded text-sm font-medium", active ? "bg-accent text-accent-foreground" : "hover:bg-white/10 text-institutional-foreground")}>
                {t.label}
              </Link>
            );
          })}
        </nav>
      }
    >
      <div className="md:hidden mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = t.exact ? location.pathname === t.to : location.pathname.startsWith(t.to);
          return <Link key={t.to} to={t.to} className={cn("px-3 py-1.5 rounded text-sm border", active ? "bg-primary text-primary-foreground border-primary" : "bg-card")}>{t.label}</Link>;
        })}
      </div>
      <Outlet />
    </AppShell>
  );
}
