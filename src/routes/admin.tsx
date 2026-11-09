import { useEffect } from "react";
import { setEncabezadoActa } from "@/lib/export-utils";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { RedirectTo } from "@/components/RedirectTo";
import { useCurrentRole } from "@/lib/use-current-user";
import { AppShell } from "@/components/AppShell";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlataforma } from "@/lib/use-plataforma";
import { featureActiva, TAB_FEATURE } from "@/lib/planes";

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
  { to: "/admin/firma", label: "Mi firma" },
  { to: "/admin/usuarios", label: "Usuarios" },
  { to: "/admin/configuracion", label: "Configuración" },
  { to: "/admin/estadisticas", label: "Estadísticas" },
  { to: "/admin/opiniones", label: "Opiniones" },
  { to: "/admin/turnos", label: "Turnos prácticos" },
];

function AdminLayout() {
  const { loading, user, isAdmin } = useCurrentRole();
  const location = useLocation();
  const { isOwner, features, institucion } = usePlataforma(user?.id);
  useEffect(() => {
    setEncabezadoActa(featureActiva(features, "actas_personalizadas") ? institucion?.nombre : null);
  }, [features, institucion?.nombre]);
  const vencida = institucion?.estado === "demo" && institucion?.demo_vence && new Date(institucion.demo_vence) < new Date();
  const cuentaBloqueada = !isOwner && (institucion?.estado === "suspendida" || !!vencida);
  const visibles = [...tabs.filter((t) => !TAB_FEATURE[t.to] || featureActiva(features, TAB_FEATURE[t.to])), ...(isOwner ? [{ to: "/admin/saas", label: "★ Clientes y planes" }] : [])];
  const bloqueada = TAB_FEATURE[location.pathname] && !featureActiva(features, TAB_FEATURE[location.pathname]);
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <RedirectTo to="/auth" />;
  if (!isAdmin) return <RedirectTo to="/panel" />;
  return (
    <AppShell title="Panel Administrador" subtitle="Gestión completa del sistema de evaluación">
      {isOwner && institucion && !institucion.es_principal && (
        <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm">
          <span>Operando como administrador en: <strong>{institucion.nombre}</strong></span>
          <Link to="/admin/saas" className="font-semibold underline">Volver a Clientes y planes</Link>
        </div>
      )}
      <nav className="no-print -mx-1 mb-4 flex flex-wrap gap-2 px-1">
        {visibles.map((t: { to: string; label: string; exact?: boolean }) => {
          const active = t.exact ? location.pathname === t.to : location.pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card hover:bg-muted",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {cuentaBloqueada ? <div className="rounded-lg border border-destructive bg-card p-8 text-center font-semibold text-destructive">{vencida ? "La demo de esta institución venció. Contacte al proveedor para activar un plan." : "La cuenta de esta institución está suspendida. Contacte al proveedor."}</div> : bloqueada ? <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Esta función no está incluida en el plan actual de la institución.</div> : <Outlet />}
    </AppShell>
  );
}
