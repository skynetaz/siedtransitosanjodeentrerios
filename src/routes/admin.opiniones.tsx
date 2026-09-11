import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarFeedback } from "@/lib/feedback.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, MessageSquareHeart, Smile, Meh, Frown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/admin/opiniones")({
  head: () => ({
    meta: [
      { title: "Opiniones de aspirantes | SIED Tránsito" },
      { name: "description", content: "Registro de encuestas de experiencia de los aspirantes al finalizar el examen teórico." },
      { property: "og:title", content: "Opiniones de aspirantes | SIED Tránsito" },
      { property: "og:description", content: "Métricas de facilidad, comodidad y comentarios de quienes rinden el examen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OpinionesPage,
});

const COMODIDAD_TXT: Record<string, string> = { comodo: "Muy cómodo", normal: "Normal", incomodo: "Incómodo" };

function OpinionesPage() {
  const listar = useServerFn(listarFeedback);
  const q = useQuery({ queryKey: ["feedback"], queryFn: async () => await listar({ data: undefined as any }) });
  const [filtro, setFiltro] = useState<"todos" | "positivo" | "neutro" | "negativo">("todos");
  const [texto, setTexto] = useState("");

  const filas = q.data?.filas ?? [];
  const r = q.data?.resumen;

  const visibles = useMemo(() => filas.filter((f) => {
    if (filtro !== "todos" && f.sentimiento !== filtro) return false;
    const t = texto.trim().toLowerCase();
    if (!t) return true;
    return [f.comentario, f.aspirante, f.dni, f.examen, ...(f.etiquetas ?? [])]
      .filter(Boolean).join(" ").toLowerCase().includes(t);
  }), [filas, filtro, texto]);

  const exportar = () => {
    const ws = XLSX.utils.json_to_sheet(visibles.map((f) => ({
      fecha: new Date(f.created_at).toLocaleString("es-AR"),
      aspirante: f.aspirante,
      dni: f.dni,
      examen: f.examen,
      resultado: f.resultado,
      facilidad: f.facilidad,
      comodidad: COMODIDAD_TXT[f.comodidad] ?? f.comodidad,
      sentimiento: f.sentimiento,
      etiquetas: (f.etiquetas ?? []).join(", "),
      comentario: f.comentario ?? "",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Opiniones");
    XLSX.writeFile(wb, "opiniones.xlsx");
  };

  if (q.isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const maxDist = Math.max(1, ...(r?.distribucion ?? []).map((d) => d.cantidad));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<MessageSquareHeart className="text-primary" />} label="Respuestas" value={r?.total ?? 0} />
        <Metric icon={<Star className="text-accent" />} label="Facilidad promedio" value={`${r?.facilidad ?? 0} / 5`} />
        <Metric icon={<Smile className="text-success" />} label="Comodidad promedio" value={`${r?.comodidad ?? 0} / 3`} />
        <Metric
          icon={<Frown className="text-destructive" />}
          label="Positivas / neutras / negativas"
          value={`${r?.positivos ?? 0} · ${r?.neutros ?? 0} · ${r?.negativos ?? 0}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Qué tan fácil les resultó la app</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(r?.distribucion ?? []).slice().reverse().map((d) => (
              <div key={d.estrellas} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">{d.estrellas} ★</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-3 rounded-full bg-primary transition-all" style={{ width: `${(d.cantidad / maxDist) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-xs tabular-nums">{d.cantidad}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Motivos más elegidos</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(r?.etiquetas ?? []).length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay motivos elegidos.</p>}
            {(r?.etiquetas ?? []).map((e) => (
              <Badge key={e.texto} variant="secondary" className="text-sm">{e.texto} · {e.cantidad}</Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Comentarios ({visibles.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {(["todos", "positivo", "neutro", "negativo"] as const).map((f) => (
              <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"} onClick={() => setFiltro(f)}>
                {f === "todos" ? "Todas" : f === "positivo" ? "Positivas" : f === "neutro" ? "Neutras" : "Negativas"}
              </Button>
            ))}
            <Input placeholder="Buscar…" value={texto} onChange={(e) => setTexto(e.target.value)} className="h-9 w-44" />
            <Button size="sm" variant="outline" onClick={exportar}><Download className="mr-1 h-4 w-4" />Excel</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibles.length === 0 && <p className="text-sm text-muted-foreground">Sin opiniones para este filtro.</p>}
          {visibles.map((f) => (
            <div key={f.id} className={cn(
              "rounded-lg border-l-4 border bg-card p-3",
              f.sentimiento === "positivo" ? "border-l-success" : f.sentimiento === "negativo" ? "border-l-destructive" : "border-l-muted-foreground",
            )}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {f.sentimiento === "positivo" ? <Smile className="h-4 w-4 text-success" /> : f.sentimiento === "negativo" ? <Frown className="h-4 w-4 text-destructive" /> : <Meh className="h-4 w-4" />}
                <span className="font-semibold text-foreground">{f.aspirante}</span>
                {f.dni && <span>DNI {f.dni}</span>}
                <span>· {f.examen}</span>
                <span>· {f.resultado}</span>
                <span className="ml-auto">{new Date(f.created_at).toLocaleString("es-AR")}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{f.facilidad} ★</span>
                <span className="text-muted-foreground">· {COMODIDAD_TXT[f.comodidad] ?? f.comodidad}</span>
                {(f.etiquetas ?? []).map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
              </div>
              {f.comentario && <p className="mt-2 text-sm">{f.comentario}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
