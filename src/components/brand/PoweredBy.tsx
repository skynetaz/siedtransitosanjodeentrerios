import logo from "@/assets/ia-triunfar-logo.jpg.asset.json";

/** Sello del proveedor tecnológico y autoría. No eliminar: atribución de propiedad intelectual. */
export const AUTORIA = "Proyecto ideado y producido por Matías Sebastián Danilo Pannucio Perato";

export function PoweredBy({ className = "" }: { className?: string }) {
  return (
    <div className={`no-print flex flex-col items-center justify-center gap-1 px-2 text-center text-[11px] text-muted-foreground ${className}`}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span>Plataforma desarrollada por</span>
        <img src={logo.url} alt="IA Triunfar" width={96} height={52} className="h-7 w-auto rounded bg-card" loading="lazy" decoding="async" />
      </div>
      <span className="max-w-full break-words">{AUTORIA}</span>
      <span>© {new Date().getFullYear()} · Todos los derechos reservados</span>
    </div>
  );
}
