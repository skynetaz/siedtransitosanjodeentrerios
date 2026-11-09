import logo from "@/assets/ia-triunfar-logo.jpg.asset.json";

/** Sello del proveedor tecnológico: discreto, nunca reemplaza la identidad del municipio. */
export function PoweredBy({ className = "" }: { className?: string }) {
  return (
    <div className={`no-print flex items-center justify-center gap-2 text-[11px] text-muted-foreground ${className}`}>
      <span>Plataforma desarrollada por</span>
      <img src={logo.url} alt="IA Triunfar" width={96} height={52} className="h-7 w-auto rounded bg-card" loading="lazy" decoding="async" />
    </div>
  );
}
