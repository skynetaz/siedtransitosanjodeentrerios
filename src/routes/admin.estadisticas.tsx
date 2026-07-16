import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/estadisticas")({ component: Stats });

function Stats() {
  const byClase = useQuery({
    queryKey: ["stats-clase"],
    queryFn: async () => {
      const { data } = await supabase.from("exams").select("clase, status").in("status", ["aprobado","desaprobado"]);
      const map: Record<string, { total: number; aprob: number }> = {};
      (data ?? []).forEach((e: any) => {
        const c = e.clase;
        map[c] ??= { total: 0, aprob: 0 };
        map[c].total++;
        if (e.status === "aprobado") map[c].aprob++;
      });
      return Object.entries(map).map(([c, v]) => ({ clase: c, ...v, pct: v.total ? Math.round((v.aprob*100)/v.total) : 0 }));
    },
  });

  const worst = useQuery({
    queryKey: ["stats-worst"],
    queryFn: async () => {
      const { data } = await supabase.from("exam_questions").select("question_id, correcta, questions(pregunta)");
      const map: Record<string, { pregunta: string; total: number; mal: number }> = {};
      (data ?? []).forEach((r: any) => {
        if (!r.question_id) return;
        map[r.question_id] ??= { pregunta: r.questions?.pregunta ?? "—", total: 0, mal: 0 };
        map[r.question_id].total++;
        if (r.correcta === false) map[r.question_id].mal++;
      });
      return Object.entries(map)
        .map(([id, v]) => ({ id, ...v, pct: v.total ? Math.round((v.mal*100)/v.total) : 0 }))
        .filter((x) => x.total >= 3)
        .sort((a,b) => b.pct - a.pct)
        .slice(0, 15);
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Aprobación por clase</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(byClase.data ?? []).map((r) => (
            <div key={r.clase}>
              <div className="flex justify-between text-sm mb-1"><span>Clase {r.clase}</span><span>{r.pct}% ({r.aprob}/{r.total})</span></div>
              <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-success" style={{ width: `${r.pct}%` }} /></div>
            </div>
          ))}
          {(byClase.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aún no hay exámenes finalizados.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Preguntas con mayor tasa de error</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(worst.data ?? []).map((r: any) => (
            <div key={r.id}>
              <div className="flex justify-between text-sm mb-1 gap-2"><span className="truncate flex-1">{r.pregunta}</span><span className="shrink-0 text-destructive font-medium">{r.pct}% errores</span></div>
              <div className="h-1.5 rounded bg-muted overflow-hidden"><div className="h-full bg-destructive" style={{ width: `${r.pct}%` }} /></div>
            </div>
          ))}
          {(worst.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin datos suficientes.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
