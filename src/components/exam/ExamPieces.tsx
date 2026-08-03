import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

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

/** Opción de respuesta: área de toque grande, un solo seleccionado. */
export function OptionCard({
  texto,
  letra,
  selected,
  disabled,
  onSelect,
}: {
  texto: string;
  letra: string;
  selected: boolean;
  disabled?: boolean;
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
        selected
          ? "border-primary bg-primary/10 shadow-md"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-sm font-bold",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 text-muted-foreground",
        )}
      >
        {selected ? <Check className="h-4 w-4" /> : letra}
      </span>
      <span className="min-w-0 text-base leading-snug break-words">{texto}</span>
    </button>
  );
}
