import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Check, X, Loader2 } from "lucide-react";

/** Barra de progreso del examen: "Pregunta 8 de 40" + porcentaje. */
export function ExamProgress({ actual, total }: { actual: number; total: number }) {
  const pct = total > 0 ? Math.round((actual / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm font-medium">
        <span>Pregunta {actual} de {total}</span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Una opción es una señal de tránsito cuando su valor es la ruta de la imagen. */
export const esSenal = (v: string) =>
  typeof v === "string" && (v.startsWith("/senales/") || v.startsWith("/api/public/senal/"));

/** Miniatura de una señal de tránsito. Carga inmediata y reintento ante cortes de internet. */
export function SenalImg({ src, className }: { src: string; className?: string }) {
  const [intento, setIntento] = useState(0);
  const [cargada, setCargada] = useState(false);
  useEffect(() => { setIntento(0); setCargada(false); }, [src]);
  const url = intento === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}r=${intento}`;
  return (
    <span className={cn("relative inline-grid h-24 w-24 place-items-center", className)}>
      {!cargada && <Loader2 className="absolute h-5 w-5 animate-spin text-muted-foreground" />}
      <img
        key={url}
        src={url}
        alt="Señal de tránsito"
        loading="eager"
        decoding="async"
        // @ts-expect-error atributo válido en navegadores modernos
        fetchpriority="high"
        width={96}
        height={96}
        draggable={false}
        onLoad={() => setCargada(true)}
        onError={() => {
          if (intento < 4) setTimeout(() => setIntento((n) => n + 1), 800 * (intento + 1));
        }}
        className={cn("h-full w-full rounded-md object-contain transition-opacity", cargada ? "opacity-100" : "opacity-0")}
      />
    </span>
  );
}

// Se guardan las imágenes precargadas para que el navegador (sobre todo iPhone) no las descarte.
const precargadas = new Map<string, HTMLImageElement>();

/** Descarga por adelantado señales (con reintentos si se corta internet). */
export function precargarSenales(valores: string[]) {
  if (typeof window === "undefined") return;
  for (const v of valores) {
    if (!esSenal(v) || precargadas.has(v)) continue;
    const img = new Image();
    let intentos = 0;
    img.onerror = () => {
      if (intentos++ < 4) setTimeout(() => { img.src = `${v}${v.includes("?") ? "&" : "?"}r=${intentos}`; }, 1500 * intentos);
    };
    img.src = v;
    precargadas.set(v, img);
  }
}

/** Opción de respuesta: área de toque grande, un solo seleccionado. */

export function OptionCard({
  texto,
  letra,
  selected,
  disabled,
  marcaIncorrecta,
  onSelect,
}: {
  texto: string;
  letra: string;
  selected: boolean;
  disabled?: boolean;
  marcaIncorrecta?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200 min-h-14 active:scale-[0.99]",
        "shadow-sm disabled:opacity-60",
        marcaIncorrecta
          ? "border-destructive bg-destructive/10"
          : selected
            ? "border-primary bg-primary/10 shadow-md"
            : "border-border bg-card hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-sm font-bold",
          marcaIncorrecta
            ? "border-destructive bg-destructive text-destructive-foreground"
            : selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 text-muted-foreground",
        )}
      >
        {marcaIncorrecta ? <X className="h-4 w-4" /> : selected ? <Check className="h-4 w-4" /> : letra}
      </span>
      <span className="min-w-0 space-y-1">
        {esSenal(texto) ? (
          <SenalImg src={texto} />
        ) : (
          <span className="block min-w-0 text-base leading-snug break-words">{texto}</span>
        )}
        {marcaIncorrecta && (
          <span className="block text-xs font-bold uppercase text-destructive">Tu respuesta incorrecta</span>
        )}
      </span>
    </button>
  );
}

