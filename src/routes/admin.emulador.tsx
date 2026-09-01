import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { startEmulation, finalizarEmulation, eliminarEmulation, listMyEmulations } from "@/lib/emulator.functions";
import { listarCategorias } from "@/lib/categorias.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OptionCard, ExamProgress } from "@/components/exam/ExamPieces";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, AlertTriangle, CheckCircle2, XCircle, Clock, Trash2, RefreshCw, ChevronRight, ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/emulador")({ component: EmuladorPage });

const LETRAS = ["A", "B", "C", "D"];

function EmuladorPage() {
  const [session, setSession] = useState<{ exam: any; questions: any[] } | null>(null);
  const [revision, setRevision] = useState<any | null>(null);
  const [categoria, setCategoria] = useState<string>("");
  const [cantidad, setCantidad] = useState<number | "">("");
  const startFn = useServerFn(startEmulation);
  const catsFn = useServerFn(listarCategorias);
  const qc = useQueryClient();
  const listFn = useServerFn(listMyEmulations);
  const emuls = useQuery({ queryKey: ["my-emulations"], queryFn: () => listFn() });
  const cats = useQuery({ queryKey: ["categorias"], queryFn: () => catsFn() });

  useEffect(() => {
    if (!categoria && (cats.data ?? []).length > 0) setCategoria((cats.data as any[])[0].slug);
  }, [cats.data, categoria]);

  const start = useMutation({
    mutationFn: async () => await startFn({ data: { categoria, cantidad: cantidad ? Number(cantidad) : undefined } }),
    onSuccess: (r: any) => { setSession(r); setRevision(null); qc.invalidateQueries({ queryKey: ["my-emulations"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (revision) return <RevisionView data={revision} onNew={() => { setRevision(null); setSession(null); }} />;
  if (session) return <EmulatorRunner session={session} onFinish={(rev) => { setSession(null); setRevision(rev); qc.invalidateQueries({ queryKey: ["my-emulations"] }); }} />;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Play className="h-5 w-5" />Emulador de examen</CardTitle>
          <CardDescription>Corré un examen de prueba idéntico al real. Al finalizar vas a ver, pregunta por pregunta, si la corrección automática dio bien.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label>Categoría de examen</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Elegí una categoría" /></SelectTrigger>
                <SelectContent>
                  {(cats.data ?? []).map((c: any) => (
                    <SelectItem key={c.slug} value={c.slug}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad (opcional)</Label>
              <Input className="h-12" type="number" min={1} max={80} placeholder="Según categoría" value={cantidad} onChange={(e) => setCantidad(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>
          <Button className="h-12 w-full" onClick={() => start.mutate()} disabled={!categoria || start.isPending}>
            {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Play className="mr-2 h-4 w-4" />Iniciar emulación
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Mis emulaciones recientes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(emuls.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Todavía no corriste ninguna.</p>}
          {(emuls.data ?? []).map((e: any) => <EmulRow key={e.id} e={e} onDeleted={() => emuls.refetch()} />)}
        </CardContent>
      </Card>
    </div>
  );
}

function EmulRow({ e, onDeleted }: { e: any; onDeleted: () => void }) {
  const delFn = useServerFn(eliminarEmulation);
  const del = useMutation({
    mutationFn: async () => await delFn({ data: { examId: e.id } }),
    onSuccess: () => { toast.success("Eliminada"); onDeleted(); },
    onError: (err) => toast.error((err as Error).message),
  });
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-0">
      <div className="min-w-0">
        <span className="font-medium">{e.config_snapshot?.nombre ?? `Clase ${e.clase}`}</span>
        <Badge variant="outline" className="ml-2">{e.status}</Badge>
        <span className="ml-2 text-muted-foreground">{e.correctas ?? 0}/{e.total_preguntas ?? 0} correctas</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        {new Date(e.created_at).toLocaleString("es-AR")}
        <Button variant="ghost" size="icon" onClick={() => del.mutate()} disabled={del.isPending}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function EmulatorRunner({ session, onFinish }: { session: { exam: any; questions: any[] }; onFinish: (rev: any) => void }) {
  const [idx, setIdx] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const finalizar = useServerFn(finalizarEmulation);
  const dur = session.exam.config_snapshot?.duracion_minutos ?? 15;
  const endTime = useMemo(() => new Date(session.exam.started_at).getTime() + dur * 60 * 1000, [session.exam.started_at, dur]);
  const [remaining, setRemaining] = useState(Math.max(0, endTime - Date.now()));

  useEffect(() => {
    const iv = setInterval(() => setRemaining(Math.max(0, endTime - Date.now())), 1000);
    return () => clearInterval(iv);
  }, [endTime]);

  const finMut = useMutation({
    mutationFn: async () => await finalizar({
      data: {
        examId: session.exam.id,
        respuestas: Object.entries(respuestas).map(([examQuestionId, respuesta]) => ({ examQuestionId, respuesta })),
      },
    }),
    onSuccess: (r) => onFinish(r),
    onError: (e) => toast.error((e as Error).message),
  });

  useEffect(() => { if (remaining === 0 && !finMut.isPending) finMut.mutate(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [remaining]);

  const q = session.questions[idx];
  const seleccion = q ? respuestas[q.id] : undefined;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const ultima = idx >= session.questions.length - 1;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2 rounded border border-warning bg-warning/10 p-2 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />Estás en <b>modo emulación</b>. No cuenta como intento real.
      </div>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1"><ExamProgress actual={idx + 1} total={session.questions.length} /></div>
        <div className={`flex shrink-0 items-center gap-2 font-mono text-lg ${remaining < 60000 ? "text-destructive" : ""}`}>
          <Clock className="h-5 w-5" />{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
      </div>
      <Card>
        <CardHeader className="pb-3">
          {q?.snapshot?.eliminatoria && <Badge className="mb-2 w-fit bg-destructive text-destructive-foreground"><AlertTriangle className="mr-1 h-3 w-3" />Eliminatoria</Badge>}
          <CardTitle className="text-lg leading-relaxed">{q?.snapshot?.pregunta}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div role="radiogroup" className="space-y-3">
            {((q?.snapshot?.opciones ?? []) as string[]).map((op, i) => (
              <OptionCard
                key={op + i}
                texto={op}
                letra={LETRAS[i] ?? String(i + 1)}
                selected={seleccion === op}
                onSelect={() => setRespuestas((r) => ({ ...r, [q.id]: op }))}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-12" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {!ultima ? (
              <Button className="h-12 flex-1" onClick={() => setIdx(idx + 1)}>Siguiente <ChevronRight className="ml-1 h-4 w-4" /></Button>
            ) : (
              <Button className="h-12 flex-1" onClick={() => finMut.mutate()} disabled={finMut.isPending}>
                {finMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Finalizar y ver revisión
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="text-center">
        <Button variant="destructive" size="sm" disabled={finMut.isPending} onClick={() => confirm("¿Terminar la emulación ahora?") && finMut.mutate()}>
          <RefreshCw className="mr-1 h-4 w-4" />Terminar ahora
        </Button>
      </div>
    </div>
  );
}

function RevisionView({ data, onNew }: { data: any; onNew: () => void }) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {data.status === "aprobado" ? <CheckCircle2 className="h-6 w-6 text-success" /> : <XCircle className="h-6 w-6 text-destructive" />}
            Revisión de la emulación — {data.status}
          </CardTitle>
          <CardDescription>
            {data.correctas} correctas · {data.incorrectas} incorrectas · {data.total} preguntas
            {data.eliminatoria ? " · desaprobó por una pregunta eliminatoria" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onNew} size="sm"><Play className="mr-1 h-4 w-4" />Nueva emulación</Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {data.revision.map((r: any) => (
          <Card key={r.orden} className={r.correcta ? "border-success/30" : "border-destructive/30"}>
            <CardContent className="space-y-1 pt-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="font-semibold">{r.orden}. {r.pregunta}</div>
                <div className="flex gap-1">
                  {r.eliminatoria && <Badge className="bg-destructive text-destructive-foreground">Eliminatoria</Badge>}
                  {r.tema && <Badge variant="outline">{r.tema}</Badge>}
                  <Badge className={r.correcta ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>{r.correcta ? "OK" : "Falló"}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2"><span className="text-muted-foreground">Respondiste:</span> {esSenal(r.respuesta_dada) ? <SenalImg src={r.respuesta_dada} className="h-16 w-16" /> : (r.respuesta_dada || "—")}</div>
              <div className="flex items-center gap-2"><span className="text-muted-foreground">Esperada:</span> {esSenal(r.respuesta_correcta) ? <SenalImg src={r.respuesta_correcta} className="h-16 w-16" /> : <b>{r.respuesta_correcta}</b>}</div>
              {r.respuestas_aceptadas?.length > 0 && !esSenal(r.respuesta_correcta) && <div className="text-xs text-muted-foreground">Variantes aceptadas: {r.respuestas_aceptadas.join(" · ")}</div>}

            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
