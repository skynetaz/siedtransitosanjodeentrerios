// Encuesta corta de experiencia al terminar el examen (aprobado o no).
// Tres pasos, mobile-first, botones grandes y transiciones suaves.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { enviarFeedback, ETIQUETAS_ENCUESTA } from "@/lib/feedback.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

const CARITAS = [
  { valor: 1, emoji: "😖", texto: "Muy difícil" },
  { valor: 2, emoji: "🙁", texto: "Difícil" },
  { valor: 3, emoji: "😐", texto: "Normal" },
  { valor: 4, emoji: "🙂", texto: "Fácil" },
  { valor: 5, emoji: "🤩", texto: "Muy fácil" },
];

const COMODIDAD = [
  { valor: "comodo", emoji: "👍", texto: "Muy cómodo" },
  { valor: "normal", emoji: "👌", texto: "Normal" },
  { valor: "incomodo", emoji: "👎", texto: "Incómodo" },
] as const;

export function EncuestaFinal({ examId }: { examId: string }) {
  const [paso, setPaso] = useState(0);
  const [oculta, setOculta] = useState(false);
  const [facilidad, setFacilidad] = useState<number | null>(null);
  const [comodidad, setComodidad] = useState<string | null>(null);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [comentario, setComentario] = useState("");
  const [listo, setListo] = useState(false);

  const enviar = useServerFn(enviarFeedback);
  const mut = useMutation({
    mutationFn: async () =>
      await enviar({ data: { examId, facilidad: facilidad!, comodidad: comodidad as any, etiquetas, comentario } }),
    onSuccess: () => setListo(true),
    onError: () => setListo(true),
  });

  if (oculta) return null;

  if (listo) {
    return (
      <div className="animate-in fade-in zoom-in-95 rounded-xl border bg-gradient-to-br from-primary/10 to-accent/10 p-6 text-center duration-500">
        <PartyPopper className="mx-auto h-10 w-10 text-accent" />
        <p className="mt-2 font-serif text-lg font-bold">¡Gracias por tu opinión!</p>
        <p className="text-sm text-muted-foreground">Nos ayuda a mejorar la experiencia del examen.</p>
      </div>
    );
  }

  const total = 3;
  const progreso = ((paso + 1) / total) * 100;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 overflow-hidden rounded-xl border bg-card shadow-sm duration-500">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
        <Sparkles className="h-4 w-4 text-accent" />
        <p className="text-sm font-semibold">Encuesta rápida · 20 segundos</p>
        <span className="ml-auto text-xs text-muted-foreground">{paso + 1}/{total}</span>
      </div>
      <div className="h-1 w-full bg-muted">
        <div className="h-1 bg-primary transition-all duration-500" style={{ width: `${progreso}%` }} />
      </div>

      <div className="space-y-4 p-4">
        {paso === 0 && (
          <div key="p0" className="animate-in fade-in slide-in-from-right-4 space-y-3 duration-300">
            <p className="text-base font-medium">¿Qué tan fácil te resultó usar la app?</p>
            <div className="grid grid-cols-5 gap-2">
              {CARITAS.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  aria-label={c.texto}
                  onClick={() => { setFacilidad(c.valor); setTimeout(() => setPaso(1), 220); }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border-2 py-3 transition-all active:scale-95",
                    facilidad === c.valor ? "border-primary bg-primary/10 scale-105" : "border-border hover:bg-muted",
                  )}
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <span className="text-[10px] leading-tight text-muted-foreground">{c.texto}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {paso === 1 && (
          <div key="p1" className="animate-in fade-in slide-in-from-right-4 space-y-3 duration-300">
            <p className="text-base font-medium">¿Te resultó cómodo rendir así?</p>
            <div className="grid grid-cols-3 gap-2">
              {COMODIDAD.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  onClick={() => { setComodidad(c.valor); setTimeout(() => setPaso(2), 220); }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border-2 py-4 transition-all active:scale-95",
                    comodidad === c.valor ? "border-primary bg-primary/10 scale-105" : "border-border hover:bg-muted",
                  )}
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <span className="text-xs font-medium">{c.texto}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {paso === 2 && (
          <div key="p2" className="animate-in fade-in slide-in-from-right-4 space-y-3 duration-300">
            <p className="text-base font-medium">¿Querés dejarnos un comentario?</p>
            <div className="flex flex-wrap gap-2">
              {ETIQUETAS_ENCUESTA.map((t) => {
                const on = etiquetas.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEtiquetas((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors active:scale-95",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <Textarea
              value={comentario}
              maxLength={500}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Contanos qué mejorarías (opcional)"
              className="min-h-24 text-base"
            />
            <Button
              size="lg"
              className="h-14 w-full text-base"
              disabled={!facilidad || !comodidad || mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
              Enviar opinión
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          {paso > 0 ? (
            <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setPaso(paso - 1)}>
              Volver
            </button>
          ) : <span />}
          <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setOculta(true)}>
            Omitir
          </button>
        </div>
      </div>
    </div>
  );
}
