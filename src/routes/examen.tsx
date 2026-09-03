import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { iniciarConCodigo, registrarEvento } from "@/lib/ingreso.functions";
import { responderPregunta, finalizarExamen } from "@/lib/exam.functions";
import { firmarAspirante } from "@/lib/exam-extra.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignaturePad } from "@/components/SignaturePad";
import { ExamProgress, OptionCard } from "@/components/exam/ExamPieces";
import { useExamGuard, requestFullscreen, exitFullscreen } from "@/components/exam/use-exam-guard";
import { AlertTriangle, CheckCircle2, Clock, Eye, EyeOff, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/examen")({
  head: () => ({
    meta: [
      { title: "Rendir examen | SIED Tránsito" },
      { name: "description", content: "Ingresá con tu DNI y el código provisto por el administrador para rendir el examen teórico de licencia de conducir." },
      { property: "og:title", content: "Rendir examen | SIED Tránsito" },
      { property: "og:description", content: "Acceso al examen teórico de licencia de conducir con DNI y código de un solo uso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamenPage,
});

type Sesion = { exam: any; questions: any[] };
/** Señal marcada por el aspirante durante el examen (para mostrar al final). */
export type SenalMarcada = { pregunta: string; imagen: string };

function ExamenPage() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [resultado, setResultado] = useState<{ status: string; examId: string; senales: SenalMarcada[] } | null>(null);

  return (
    <div className="min-h-screen bg-background flex flex-col select-none">
      <header className="gov-header">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2.5 px-4 py-3">
          <ShieldCheck className="h-6 w-6 shrink-0 text-accent" />
          <div className="min-w-0 leading-tight">
            <div className="truncate font-serif text-base font-bold">SIED · Examen teórico</div>
            <div className="truncate text-[10px] uppercase tracking-widest opacity-80">Tránsito y Transporte</div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        {resultado ? (
          <Resultado status={resultado.status} examId={resultado.examId} senales={resultado.senales} />
        ) : sesion ? (
          <Runner
            sesion={sesion}
            onFinish={(status, senales) => {
              exitFullscreen();
              setResultado({ status, examId: sesion.exam.id, senales });
              setSesion(null);
            }}
          />
        ) : (
          <Ingreso onStart={setSesion} />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------
// Pantalla de ingreso: DNI + código
// ---------------------------------------------------------------
function Ingreso({ onStart }: { onStart: (s: Sesion) => void }) {
  const [dni, setDni] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ver, setVer] = useState(false);
  const iniciar = useServerFn(iniciarConCodigo);

  const mut = useMutation({
    mutationFn: async () => {
      const limpio = codigo.trim().toUpperCase();
      const { error } = await supabase.auth.signInWithPassword({
        email: `${dni.trim()}@aspirante.local`,
        password: limpio,
      });
      if (error) throw new Error("DNI o código incorrecto.");
      return await iniciar({ data: { codigo: limpio } });
    },
    onSuccess: async (r) => {
      await requestFullscreen();
      onStart(r as Sesion);
    },
    onError: async (e) => {
      await supabase.auth.signOut();
      toast.error((e as Error).message);
    },
  });

  const puede = dni.trim().length >= 6 && codigo.trim().length >= 4;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Ingreso al examen</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ingresá tu DNI y el código que te entregó el administrador. El código vence a los 15 minutos y es de un solo uso.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="dni" className="text-base">DNI</Label>
          <Input
            id="dni" inputMode="numeric" autoComplete="off" maxLength={12}
            className="h-14 text-lg" placeholder="30123456"
            value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="codigo" className="text-base">Código del examen</Label>
          <div className="relative">
            <Input
              id="codigo" type={ver ? "text" : "password"} autoComplete="off" maxLength={8}
              className="h-14 pr-14 text-lg tracking-[0.3em] uppercase" placeholder="K7QX91"
              value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            />
            <button
              type="button" onClick={() => setVer((v) => !v)}
              aria-label={ver ? "Ocultar código" : "Mostrar código"}
              className="absolute right-1 top-1 grid h-12 w-12 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            >
              {ver ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <Button size="lg" className="h-14 w-full text-base" disabled={!puede || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}INGRESAR
        </Button>
        <p className="text-xs text-muted-foreground">
          Al ingresar comienza el examen inmediatamente. No cambies de pestaña ni salgas de la pantalla: el sistema lo registra y puede cancelar tu intento.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------
// Motor de examen multiple choice
// ---------------------------------------------------------------
const LETRAS = ["A", "B", "C", "D"];

function Runner({ sesion, onFinish }: { sesion: Sesion; onFinish: (status: string, senales: SenalMarcada[]) => void }) {
  const { exam, questions } = sesion;
  const [idx, setIdx] = useState(0);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [advertencia, setAdvertencia] = useState<string | null>(null);
  const finishing = useRef(false);
  /** Señales que el aspirante fue marcando, para mostrarlas al finalizar. */
  const senalesRef = useRef<SenalMarcada[]>([]);

  const dur = exam.config_snapshot?.duracion_minutos ?? 15;
  const endTime = new Date(exam.started_at).getTime() + dur * 60_000;
  const [restante, setRestante] = useState(Math.max(0, endTime - Date.now()));

  const responder = useServerFn(responderPregunta);
  const finalizar = useServerFn(finalizarExamen);
  const evento = useServerFn(registrarEvento);

  const cerrar = useCallback(async (motivo?: string) => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      const r = await finalizar({ data: { examId: exam.id } });
      onFinish(motivo ? "cancelado" : (r as any).status, senalesRef.current);
    } catch {
      onFinish("cancelado", senalesRef.current);
    }
  }, [exam.id, finalizar, onFinish]);

  const onWarning = useCallback((motivo: string) => {
    setAdvertencia(motivo);
    evento({ data: { examId: exam.id, tipo: "warning", motivo, finalizar: false } }).catch(() => {});
  }, [exam.id, evento]);

  const onCancel = useCallback((motivo: string) => {
    if (finishing.current) return;
    finishing.current = true;
    evento({ data: { examId: exam.id, tipo: "tab_change", motivo, finalizar: true } })
      .catch(() => {})
      .finally(() => onFinish("cancelado", senalesRef.current));
  }, [exam.id, evento, onFinish]);

  useExamGuard({ active: true, onWarning, onCancel });

  useEffect(() => {
    const iv = setInterval(() => setRestante(Math.max(0, endTime - Date.now())), 1000);
    return () => clearInterval(iv);
  }, [endTime]);

  useEffect(() => { if (restante === 0) cerrar(); }, [restante, cerrar]);

  const respMut = useMutation({
    mutationFn: async (payload: { examQuestionId: string; respuesta: string }) => await responder({ data: payload }),
    onSuccess: (r: any) => {
      if (r.terminado) { cerrar("eliminatoria"); return; }
      setSeleccion(null);
      if (idx < questions.length - 1) setIdx(idx + 1);
      else cerrar();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const actual = questions[idx];
  const opciones: string[] = actual?.snapshot?.opciones ?? [];
  const mins = Math.floor(restante / 60000);
  const secs = Math.floor((restante % 60000) / 1000);

  if (!actual) return <Loader2 className="mx-auto h-6 w-6 animate-spin" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <ExamProgressWrapper actual={idx + 1} total={questions.length} />
        <div className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-lg tabular-nums ${restante < 60000 ? "border-destructive text-destructive" : ""}`}>
          <Clock className="h-4 w-4" />
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
      </div>

      {advertencia && (
        <div className="flex gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span><strong>Advertencia:</strong> {advertencia}. Si vuelve a ocurrir, el examen se cancela automáticamente.</span>
        </div>
      )}

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg leading-snug">{actual.snapshot?.pregunta}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div role="radiogroup" className="space-y-3">
            {opciones.map((op, i) => (
              <OptionCard
                key={op + i}
                texto={op}
                letra={LETRAS[i] ?? String(i + 1)}
                selected={seleccion === op}
                disabled={respMut.isPending}
                onSelect={() => setSeleccion(op)}
              />
            ))}
          </div>
          <Button
            size="lg"
            className="h-14 w-full text-base"
            disabled={!seleccion || respMut.isPending}
            onClick={() => respMut.mutate({ examQuestionId: actual.id, respuesta: seleccion! })}
          >
            {respMut.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {idx < questions.length - 1 ? "Siguiente" : "Finalizar examen"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ExamProgressWrapper({ actual, total }: { actual: number; total: number }) {
  return <div className="min-w-0 flex-1"><ExamProgress actual={actual} total={total} /></div>;
}

// ---------------------------------------------------------------
// Resultado: solo aprobado / desaprobado + firma
// ---------------------------------------------------------------
function Resultado({ status, examId }: { status: string; examId: string }) {
  const aprobado = status === "aprobado";
  const cancelado = status === "cancelado";
  const [firmado, setFirmado] = useState(false);
  const firmarFn = useServerFn(firmarAspirante);
  const firmar = useMutation({
    mutationFn: async (firma: string) => await firmarFn({ data: { examId, firma } }),
    onSuccess: () => { setFirmado(true); toast.success("Firma registrada."); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-5 pt-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {aprobado ? <CheckCircle2 className="h-14 w-14 text-success" /> : <XCircle className="h-14 w-14 text-destructive" />}
          <p className={`font-serif text-3xl font-black tracking-tight ${aprobado ? "text-success" : "text-destructive"}`}>
            {cancelado ? "EXAMEN CANCELADO" : aprobado ? "APROBADO" : "DESAPROBADO"}
          </p>
          {cancelado && <p className="text-sm text-muted-foreground">El intento se cerró por incumplir las condiciones del examen.</p>}
        </div>

        {!cancelado && (
          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">Firma del aspirante</p>
            {firmado ? (
              <p className="text-sm text-muted-foreground">Firma registrada correctamente. Ya podés retirarte.</p>
            ) : (
              <SignaturePad label="Firmá para dejar registro del examen" onSave={(url) => firmar.mutate(url)} />
            )}
          </div>
        )}

        <Button
          variant="outline" size="lg" className="h-12 w-full"
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
        >
          Salir
        </Button>
      </CardContent>
    </Card>
  );
}
