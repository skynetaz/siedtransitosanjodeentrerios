import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCurrentRole } from "@/lib/use-current-user";
import { AppShell } from "@/components/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyExam, iniciarExamen, responderPregunta, finalizarExamen, registrarFocusLoss } from "@/lib/exam.functions";
import { confirmarDatosPrevios, firmarAspirante } from "@/lib/exam-extra.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/SignaturePad";
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, Send, Signature } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/aspirante")({ component: AspirantePanel });

function AspirantePanel() {
  const { loading, user, isAspirante } = useCurrentRole();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAspirante) return <Navigate to="/panel" replace />;
  return (
    <AppShell title="Mi examen" subtitle="Panel del aspirante">
      <ExamFlow />
    </AppShell>
  );
}

function ExamFlow() {
  const qc = useQueryClient();
  const getMy = useServerFn(getMyExam);
  const iniciar = useServerFn(iniciarExamen);
  const [session, setSession] = useState<{ exam: any; questions: any[] } | null>(null);

  const my = useQuery({ queryKey: ["my-exam"], queryFn: () => getMy() });

  const start = useMutation({
    mutationFn: async () => await iniciar({ data: { examId: my.data!.id } }),
    onSuccess: (r) => { setSession(r); qc.invalidateQueries({ queryKey: ["my-exam"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  useEffect(() => {
    if (my.data?.status === "rindiendo" && !session) {
      start.mutate();
    }
  }, [my.data?.status]);

  if (my.isLoading) return <Loader2 className="h-6 w-6 animate-spin" />;
  const exam = my.data;
  if (!exam) return <EmptyState msg="Todavía no tenés un examen habilitado. Acercate al inspector." />;

  if (exam.status === "habilitado") return <PreExamStep exam={exam} onReady={() => start.mutate()} loading={start.isPending} />;

  if (exam.status === "rindiendo" && session) return <ExamRunner exam={session.exam} questions={session.questions} onFinish={() => { setSession(null); qc.invalidateQueries({ queryKey: ["my-exam"] }); }} />;
  if (exam.status === "rindiendo") return <Loader2 className="h-6 w-6 animate-spin" />;

  return <ResultCard exam={exam} />;
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="max-w-md mx-auto text-center py-12 text-muted-foreground">{msg}</div>;
}

function ExamRunner({ exam, questions, onFinish }: { exam: any; questions: any[]; onFinish: () => void }) {
  const [idx, setIdx] = useState(() => Math.max(0, questions.findIndex((q: any) => !q.respuesta_dada)));
  const [answer, setAnswer] = useState("");
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const dur = exam.config_snapshot?.duracion_minutos ?? 15;
  const started = new Date(exam.started_at).getTime();
  const endTime = started + dur * 60 * 1000;
  const [remaining, setRemaining] = useState(Math.max(0, endTime - Date.now()));

  const responder = useServerFn(responderPregunta);
  const finalizar = useServerFn(finalizarExamen);
  const focusLoss = useServerFn(registrarFocusLoss);
  const [focusWarn, setFocusWarn] = useState(0);

  const respMut = useMutation({
    mutationFn: async (payload: { examQuestionId: string; respuesta: string }) => await responder({ data: payload }),
    onSuccess: (r, vars) => {
      setAnswered({ ...answered, [vars.examQuestionId]: r.correcta });
      if (r.terminado) { toast.error("Examen finalizado por respuesta eliminatoria."); onFinish(); return; }
      setAnswer("");
      if (idx < questions.length - 1) setIdx(idx + 1);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const finalizeMut = useMutation({
    mutationFn: async () => await finalizar({ data: { examId: exam.id } }),
    onSuccess: (r) => { toast.success(r.status === "aprobado" ? "¡Aprobado!" : "Examen finalizado"); onFinish(); },
    onError: (e) => toast.error((e as Error).message),
  });

  useEffect(() => {
    const iv = setInterval(() => setRemaining(Math.max(0, endTime - Date.now())), 1000);
    return () => clearInterval(iv);
  }, [endTime]);
  useEffect(() => { if (remaining === 0 && exam.status === "rindiendo") finalizeMut.mutate(); }, [remaining]);

  useEffect(() => {
    const onBlur = () => { setFocusWarn((c) => c + 1); focusLoss({ data: { examId: exam.id } }).catch(() => {}); };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", () => { if (document.hidden) onBlur(); });
    return () => window.removeEventListener("blur", onBlur);
  }, [exam.id]);

  const current = questions[idx];
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const doneCount = Object.keys(answered).length + questions.filter((q) => q.respuesta_dada && !(q.id in answered)).length;

  if (!current) return <Loader2 className="h-6 w-6 animate-spin" />;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <Badge variant="outline" className="text-base py-1.5 px-3">Pregunta {idx + 1} de {questions.length}</Badge>
        <div className={`flex items-center gap-2 font-mono text-lg ${remaining < 60000 ? "text-destructive" : ""}`}>
          <Clock className="h-5 w-5" />
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
      </div>
      {focusWarn > 0 && (
        <div className="rounded border border-warning bg-warning/10 p-3 flex gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <span>Detectamos que saliste de la pantalla {focusWarn} vez(ces). Este comportamiento queda registrado.</span>
        </div>
      )}
      <Card>
        <CardHeader className="pb-3">
          {current.snapshot?.eliminatoria && (
            <Badge className="bg-destructive text-destructive-foreground w-fit mb-2"><AlertTriangle className="mr-1 h-3 w-3" />Pregunta eliminatoria</Badge>
          )}
          <CardTitle className="text-lg leading-relaxed">{current.snapshot?.pregunta}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea rows={3} placeholder="Escribí tu respuesta…" value={answer} onChange={(e) => setAnswer(e.target.value)} autoFocus />
          <div className="mt-4 flex justify-between gap-2">
            <Button variant="outline" onClick={() => idx > 0 && setIdx(idx - 1)} disabled={idx === 0}>Anterior</Button>
            <div className="flex gap-2">
              <Button onClick={() => respMut.mutate({ examQuestionId: current.id, respuesta: answer })} disabled={!answer.trim() || respMut.isPending}>
                {respMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar respuesta
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="text-center">
        <Button variant="destructive" size="sm" onClick={() => confirm("¿Finalizar examen ahora?") && finalizeMut.mutate()} disabled={finalizeMut.isPending}>
          <Send className="mr-1 h-4 w-4" />Finalizar examen
        </Button>
        <p className="text-xs text-muted-foreground mt-1">Respondiste {doneCount} de {questions.length}</p>
      </div>
    </div>
  );
}

function PreExamStep({ exam, onReady, loading }: { exam: any; onReady: () => void; loading: boolean }) {
  const d = exam.datos_aspirante ?? {};
  const [form, setForm] = useState({
    nombre: d.nombre ?? "", apellido: d.apellido ?? "",
    dni: d.dni ?? "", email: d.email ?? "", telefono: d.telefono ?? "",
  });
  const confirmFn = useServerFn(confirmarDatosPrevios);
  const mut = useMutation({
    mutationFn: async () => await confirmFn({ data: { examId: exam.id, datos: form } }),
    onSuccess: () => onReady(),
    onError: (e) => toast.error((e as Error).message),
  });
  const canSubmit = form.nombre.trim() && form.apellido.trim() && form.dni.trim().length >= 6;
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Confirmá tus datos</CardTitle>
        <CardDescription>Antes de comenzar, verificá que estos datos sean correctos. Clase {exam.clase}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Nombre</Label><Input value={form.nombre} onChange={(e)=>setForm({...form, nombre: e.target.value})} /></div>
          <div><Label>Apellido</Label><Input value={form.apellido} onChange={(e)=>setForm({...form, apellido: e.target.value})} /></div>
          <div><Label>DNI</Label><Input value={form.dni} onChange={(e)=>setForm({...form, dni: e.target.value})} /></div>
          <div><Label>Teléfono</Label><Input value={form.telefono} onChange={(e)=>setForm({...form, telefono: e.target.value})} /></div>
          <div className="sm:col-span-2"><Label>Correo</Label><Input type="email" value={form.email} onChange={(e)=>setForm({...form, email: e.target.value})} /></div>
        </div>
        <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
          <li>Tiempo limitado. Preguntas eliminatorias desaprueban en el acto.</li>
          <li>Salir de la pantalla queda registrado.</li>
          <li>Al finalizar deberás firmar digitalmente el examen.</li>
        </ul>
        <Button size="lg" className="w-full" onClick={() => mut.mutate()} disabled={!canSubmit || mut.isPending || loading}>
          {(mut.isPending || loading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar datos y comenzar
        </Button>
      </CardContent>
    </Card>
  );
}

function ResultCard({ exam }: { exam: any }) {
  const aprobado = exam.status === "aprobado";
  const desap = exam.status === "desaprobado";
  const qc = useQueryClient();
  const firmarFn = useServerFn(firmarAspirante);
  const firmar = useMutation({
    mutationFn: async (firma: string) => await firmarFn({ data: { examId: exam.id, firma } }),
    onSuccess: () => { toast.success("Firma registrada. Gracias."); qc.invalidateQueries({ queryKey: ["my-exam"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {aprobado && <CheckCircle2 className="h-6 w-6 text-success" />}
          {desap && <XCircle className="h-6 w-6 text-destructive" />}
          Examen {exam.status}
        </CardTitle>
        <CardDescription>Clase {exam.clase} · {exam.finished_at ? new Date(exam.finished_at).toLocaleString("es-AR") : "—"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded border p-3"><div className="text-2xl font-bold">{exam.correctas}</div><div className="text-xs text-muted-foreground">Correctas</div></div>
          <div className="rounded border p-3"><div className="text-2xl font-bold">{exam.incorrectas}</div><div className="text-xs text-muted-foreground">Incorrectas</div></div>
          <div className="rounded border p-3"><div className="text-2xl font-bold">{exam.total_preguntas}</div><div className="text-xs text-muted-foreground">Total</div></div>
        </div>
        {desap && exam.eliminado_por_pregunta && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm">
            Desaprobado por responder incorrectamente una pregunta eliminatoria.
          </div>
        )}
        {desap && <p className="text-sm text-muted-foreground">Para volver a rendir, el inspector debe habilitarte un nuevo intento.</p>}
        <div className="pt-2 border-t">
          <p className="text-sm font-medium flex items-center gap-1 mb-2"><Signature className="h-4 w-4" />Firma del aspirante</p>
          {exam.signature_aspirante ? (
            <div>
              <img src={exam.signature_aspirante} alt="Firma" className="border rounded bg-white max-h-40" />
              <p className="text-xs text-muted-foreground mt-1">Firmado el {new Date(exam.signed_aspirante_at).toLocaleString("es-AR")}</p>
            </div>
          ) : (
            <SignaturePad label="Firmá para dejar registro del examen" onSave={(url) => firmar.mutate(url)} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
