import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { startEmulation, responderEmulation, finalizarEmulation, eliminarEmulation, listMyEmulations } from "@/lib/emulator.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, AlertTriangle, CheckCircle2, XCircle, Clock, Trash2, RefreshCw, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/emulador")({ component: EmuladorPage });

function EmuladorPage() {
  const [session, setSession] = useState<{ exam: any; questions: any[] } | null>(null);
  const [revision, setRevision] = useState<any | null>(null);
  const [clase, setClase] = useState<"A"|"B"|"C"|"D"|"E"|"UNICA">("B");
  const [cantidad, setCantidad] = useState<number | "">("");
  const startFn = useServerFn(startEmulation);
  const qc = useQueryClient();
  const listFn = useServerFn(listMyEmulations);
  const emuls = useQuery({ queryKey: ["my-emulations"], queryFn: () => listFn() });

  const start = useMutation({
    mutationFn: async () => await startFn({ data: { clase, cantidad: cantidad ? Number(cantidad) : undefined } }),
    onSuccess: (r) => { setSession(r); setRevision(null); qc.invalidateQueries({ queryKey: ["my-emulations"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (revision) return <RevisionView data={revision} onNew={() => { setRevision(null); setSession(null); }} />;
  if (session) return <EmulatorRunner session={session} onFinish={(rev) => { setSession(null); setRevision(rev); qc.invalidateQueries({ queryKey: ["my-emulations"] }); }} />;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Play className="h-5 w-5" />Emulador de examen</CardTitle>
          <CardDescription>Corré un examen de prueba idéntico al real. Al finalizar vas a ver, pregunta por pregunta, si la corrección automática dio bien.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label>Clase</Label>
              <Select value={clase} onValueChange={(v)=>setClase(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["UNICA","A","B","C","D","E"].map((c)=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Cantidad (opcional)</Label><Input type="number" min={1} max={60} placeholder="Config. actual" value={cantidad} onChange={(e)=>setCantidad(e.target.value === "" ? "" : Number(e.target.value))} /></div>
            <div className="flex items-end">
              <Button className="w-full" onClick={()=>start.mutate()} disabled={start.isPending}>
                {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Play className="mr-2 h-4 w-4" />Iniciar emulación
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Mis emulaciones recientes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(emuls.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Todavía no corriste ninguna.</p>}
          {(emuls.data ?? []).map((e: any) => <EmulRow key={e.id} e={e} onDeleted={()=>emuls.refetch()} />)}
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
    <div className="flex items-center justify-between text-sm border-b last:border-0 py-2">
      <div>
        <span className="font-medium">Clase {e.clase}</span>
        <Badge variant="outline" className="ml-2">{e.status}</Badge>
        <span className="text-muted-foreground ml-2">{e.correctas ?? 0}/{e.total_preguntas ?? 0} correctas</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {new Date(e.created_at).toLocaleString("es-AR")}
        <Button variant="ghost" size="icon" onClick={()=>del.mutate()} disabled={del.isPending}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function EmulatorRunner({ session, onFinish }: { session: { exam: any; questions: any[] }; onFinish: (rev: any) => void }) {
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [instantFeedback, setInstantFeedback] = useState<any | null>(null);
  const responder = useServerFn(responderEmulation);
  const finalizar = useServerFn(finalizarEmulation);
  const dur = session.exam.config_snapshot?.duracion_minutos ?? 15;
  const endTime = new Date(session.exam.started_at).getTime() + dur * 60 * 1000;
  const [remaining, setRemaining] = useState(Math.max(0, endTime - Date.now()));
  useEffect(() => {
    const iv = setInterval(() => setRemaining(Math.max(0, endTime - Date.now())), 1000);
    return () => clearInterval(iv);
  }, [endTime]);

  const respMut = useMutation({
    mutationFn: async () => await responder({ data: { examQuestionId: session.questions[idx].id, respuesta: answer } }),
    onSuccess: (r) => { setInstantFeedback(r); },
    onError: (e) => toast.error((e as Error).message),
  });
  const finMut = useMutation({
    mutationFn: async () => await finalizar({ data: { examId: session.exam.id } }),
    onSuccess: (r) => onFinish(r),
    onError: (e) => toast.error((e as Error).message),
  });

  useEffect(() => { if (remaining === 0) finMut.mutate(); }, [remaining]);

  const q = session.questions[idx];
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  const next = () => { setAnswer(""); setInstantFeedback(null); if (idx < session.questions.length - 1) setIdx(idx + 1); else finMut.mutate(); };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="rounded border border-warning bg-warning/10 p-2 text-sm flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning" />Estás en <b>modo emulación</b>. No cuenta como intento real.
      </div>
      <div className="flex justify-between items-center flex-wrap gap-2">
        <Badge variant="outline" className="text-base py-1.5 px-3">Pregunta {idx + 1} de {session.questions.length}</Badge>
        <div className={`flex items-center gap-2 font-mono text-lg ${remaining < 60000 ? "text-destructive" : ""}`}>
          <Clock className="h-5 w-5" />{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
      </div>
      <Card>
        <CardHeader className="pb-3">
          {q.snapshot?.eliminatoria && <Badge className="bg-destructive text-destructive-foreground w-fit mb-2"><AlertTriangle className="mr-1 h-3 w-3" />Eliminatoria</Badge>}
          <CardTitle className="text-lg leading-relaxed">{q.snapshot?.pregunta}</CardTitle>
        </CardHeader>
        <CardContent>
          {(q.snapshot?.opciones ?? []).length > 0 ? (
            <div role="radiogroup" className="space-y-3">
              {(q.snapshot.opciones as string[]).map((op, i) => (
                <OptionCard
                  key={op + i}
                  texto={op}
                  letra={["A", "B", "C", "D"][i] ?? String(i + 1)}
                  selected={answer === op}
                  disabled={!!instantFeedback}
                  onSelect={() => setAnswer(op)}
                />
              ))}
            </div>
          ) : (
            <Textarea rows={3} placeholder="Escribí tu respuesta…" value={answer} onChange={(e)=>setAnswer(e.target.value)} disabled={!!instantFeedback} />
          )}
          {instantFeedback && (
            <div className={`mt-3 rounded p-3 text-sm border ${instantFeedback.correcta ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
              <div className="flex items-center gap-2 font-medium">
                {instantFeedback.correcta ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                {instantFeedback.correcta ? "Correcta" : "Incorrecta"}
              </div>
              <div className="mt-1"><b>Respuesta esperada:</b> {instantFeedback.esperada}</div>
              {instantFeedback.aceptadas?.length > 0 && <div className="mt-0.5 text-xs text-muted-foreground">Variantes aceptadas: {instantFeedback.aceptadas.join(" · ")}</div>}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            {!instantFeedback ? (
              <Button onClick={()=>respMut.mutate()} disabled={!answer.trim() || respMut.isPending}>
                {respMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar respuesta
              </Button>
            ) : (
              <Button onClick={next}>{idx < session.questions.length - 1 ? <>Siguiente <ChevronRight className="ml-1 h-4 w-4" /></> : "Finalizar"}</Button>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="text-center">
        <Button variant="destructive" size="sm" onClick={()=>confirm("¿Terminar la emulación ahora?") && finMut.mutate()}><RefreshCw className="mr-1 h-4 w-4" />Terminar y ver revisión</Button>
      </div>
    </div>
  );
}

function RevisionView({ data, onNew }: { data: any; onNew: () => void }) {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {data.status === "aprobado" ? <CheckCircle2 className="h-6 w-6 text-success" /> : <XCircle className="h-6 w-6 text-destructive" />}
            Revisión de la emulación — {data.status}
          </CardTitle>
          <CardDescription>{data.correctas} correctas · {data.incorrectas} incorrectas · {data.total} preguntas</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onNew} size="sm"><Play className="mr-1 h-4 w-4" />Nueva emulación</Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {data.revision.map((r: any) => (
          <Card key={r.orden} className={r.correcta ? "border-success/30" : "border-destructive/30"}>
            <CardContent className="pt-4 space-y-1 text-sm">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="font-semibold">{r.orden}. {r.pregunta}</div>
                <div className="flex gap-1">
                  {r.eliminatoria && <Badge className="bg-destructive text-destructive-foreground">Eliminatoria</Badge>}
                  {r.tema && <Badge variant="outline">{r.tema}</Badge>}
                  <Badge className={r.correcta ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>{r.correcta ? "OK" : "Falló"}</Badge>
                </div>
              </div>
              <div><span className="text-muted-foreground">Respondiste:</span> {r.respuesta_dada || "—"}</div>
              <div><span className="text-muted-foreground">Esperada:</span> <b>{r.respuesta_correcta}</b></div>
              {r.respuestas_aceptadas?.length > 0 && <div className="text-xs text-muted-foreground">Variantes aceptadas: {r.respuestas_aceptadas.join(" · ")}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
