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

  const tiempos = useQuery({
    queryKey: ["stats-tiempos"],
    queryFn: async () => {
      const { data } = await supabase.from("exams")
        .select("categoria_slug, config_snapshot, status, started_at, finished_at, tiempo_utilizado_seg, motivo_finalizacion, is_emulation")
        .in("status", ["aprobado", "desaprobado"]);
      const filas = (data ?? []).filter((e: any) => !e.is_emulation).map((e: any) => {
        const cfg = e.config_snapshot ?? {};
        const lim = (cfg.duracion_minutos ?? 15) * 60;
        let s = e.tiempo_utilizado_seg as number | null;
        if (s == null && e.started_at && e.finished_at) s = Math.round((+new Date(e.finished_at) - +new Date(e.started_at)) / 1000);
        return { nombre: cfg.nombre ?? e.categoria_slug ?? "Sin categoría", s: s == null ? null : Math.min(Math.max(s, 0), lim), lim, status: e.status, agotado: String(e.motivo_finalizacion ?? "").includes("tiempo agotado") };
      }).filter((f) => f.s != null) as { nombre: string; s: number; lim: number; status: string; agotado: boolean }[];
      const prom = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
      const med = (a: number[]) => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
      const map: Record<string, typeof filas> = {};
      filas.forEach((f) => { (map[f.nombre] ??= []).push(f); });
      const porCat = Object.entries(map).map(([nombre, fs]) => {
        const aprob = fs.filter((f) => f.status === "aprobado").map((f) => f.s);
        return { nombre, n: fs.length, prom: prom(fs.map((f) => f.s)), ideal: med(aprob), min: Math.min(...fs.map((f) => f.s)), max: Math.max(...fs.map((f) => f.s)), lim: fs[0].lim, agotados: fs.filter((f) => f.agotado).length };
      }).sort((a, b) => b.n - a.n);
      return {
        n: filas.length, prom: prom(filas.map((f) => f.s)),
        promAprob: prom(filas.filter((f) => f.status === "aprobado").map((f) => f.s)),
        promDesap: prom(filas.filter((f) => f.status === "desaprobado").map((f) => f.s)),
        agotados: filas.filter((f) => f.agotado).length, porCat,
      };
    },
  });

  const t = tiempos.data;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Tiempo de resolución de exámenes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!t || t.n === 0 ? <p className="text-sm text-muted-foreground">Aún no hay tiempos registrados.</p> : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Dato titulo="Promedio general" valor={fmt(t.prom)} />
                <Dato titulo="Promedio aprobados" valor={fmt(t.promAprob)} />
                <Dato titulo="Promedio desaprobados" valor={fmt(t.promDesap)} />
                <Dato titulo="Tiempo agotado" valor={`${t.agotados} de ${t.n}`} />
              </div>
              <div className="space-y-3">
                {t.porCat.map((c) => (
                  <div key={c.nombre} className="rounded-md border p-3">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-semibold">{c.nombre}</span>
                      <span className="text-muted-foreground">{c.n} exámenes · límite {fmt(c.lim)}</span>
                    </div>
                    <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.round((c.prom * 100) / c.lim))}%` }} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs sm:grid-cols-5">
                      <span>Promedio: <b>{fmt(c.prom)}</b></span>
                      <span>Ideal (aprobados): <b>{c.ideal ? fmt(c.ideal) : "—"}</b></span>
                      <span>Más rápido: <b>{fmt(c.min)}</b></span>
                      <span>Más lento: <b>{fmt(c.max)}</b></span>
                      <span>Tiempo agotado: <b>{c.agotados}</b></span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">"Ideal" es el tiempo típico (mediana) de quienes aprobaron cada categoría. No incluye exámenes del emulador.</p>
            </>
          )}
        </CardContent>
      </Card>
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

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m} min ${String(r).padStart(2, "0")} s`;
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{titulo}</div>
      <div className="text-lg font-bold">{valor}</div>
    </div>
  );
}
