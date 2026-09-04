import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListChecks, Loader2, AlertTriangle, Eye, ArrowUp, ArrowDown, Plus, Minus } from "lucide-react";
import { esSenal, SenalImg } from "@/components/exam/ExamPieces";

export const Route = createFileRoute("/admin/configuracion")({ component: Config });

const CLASES = ["UNICA","A","B","C","D","E"] as const;

function Config() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["exam-configs"], queryFn: async () => (await supabase.from("exam_configs").select("*")).data ?? [] });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de exámenes por clase</CardTitle>
          <CardDescription>Cantidad de preguntas, duración y máximo de errores permitidos. Con "Ver preguntas de la clase" podés revisar y marcar cuáles entran en el examen, y en la vista previa podés reordenarlas antes de guardar.</CardDescription>
        </CardHeader>
        <CardContent><TodasLasSenalesDialog /></CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CLASES.map((c) => {
          const cfg = (q.data ?? []).find((x: any) => x.clase === c) as any;
          return cfg && <ConfigCard key={c} cfg={cfg} onSaved={() => qc.invalidateQueries({ queryKey: ["exam-configs"] })} />;
        })}
      </div>
    </div>
  );
}

type Cfg = { cantidad_preguntas: number; duracion_minutos: number; max_errores: number };

function ConfigCard({ cfg, onSaved }: { cfg: any; onSaved: () => void }) {
  const [f, setF] = useState<Cfg>({ cantidad_preguntas: cfg.cantidad_preguntas, duracion_minutos: cfg.duracion_minutos, max_errores: cfg.max_errores });
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Orden manual de las preguntas (ids) definido en la vista previa. */
  const [orden, setOrden] = useState<string[]>([]);
  useEffect(() => setF({ cantidad_preguntas: cfg.cantidad_preguntas, duracion_minutos: cfg.duracion_minutos, max_errores: cfg.max_errores }), [cfg]);

  // Preguntas activas actuales de la clase (para el diff al guardar).
  const activas = useQuery({
    queryKey: ["activas-clase", cfg.clase],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, pregunta, peso")
        .eq("clase", cfg.clase as any)
        .eq("activa", true)
        .order("pregunta");
      if (error) throw error;
      return data as any[];
    },
  });

  // Línea base: primera lectura tras cargar la pantalla o tras guardar.
  const baseRef = useRef<{ id: string; pregunta: string }[] | null>(null);
  useEffect(() => {
    if (activas.data && baseRef.current === null) baseRef.current = activas.data.map((p) => ({ id: p.id, pregunta: p.pregunta }));
  }, [activas.data]);

  const mut = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("exam_configs").update(f).eq("clase", cfg.clase); if (error) throw error; },
    onSuccess: () => {
      toast.success("Configuración actualizada");
      baseRef.current = (activas.data ?? []).map((p: any) => ({ id: p.id, pregunta: p.pregunta }));
      setConfirmOpen(false);
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const base = baseRef.current ?? [];
  const actual = activas.data ?? [];
  const agregadas = actual.filter((p: any) => !base.some((b) => b.id === p.id));
  const quitadas = base.filter((b) => !actual.some((p: any) => p.id === b.id));
  const cambiosCfg = [
    { label: "Cantidad de preguntas", de: cfg.cantidad_preguntas, a: f.cantidad_preguntas },
    { label: "Duración (minutos)", de: cfg.duracion_minutos, a: f.duracion_minutos },
    { label: "Máximo de errores", de: cfg.max_errores, a: f.max_errores },
  ].filter((c) => c.de !== c.a);
  const puntajeDe = base.length;
  const puntajeA = actual.reduce((a: number, p: any) => a + (p.peso ?? 1), 0);
  const sinCambios = cambiosCfg.length === 0 && agregadas.length === 0 && quitadas.length === 0;

  return (
    <Card>
      <CardHeader><CardTitle>Clase {cfg.clase}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Cantidad de preguntas</Label><Input type="number" value={f.cantidad_preguntas} onChange={(e) => setF({ ...f, cantidad_preguntas: parseInt(e.target.value)||0 })} /></div>
        <div><Label>Duración (minutos)</Label><Input type="number" value={f.duracion_minutos} onChange={(e) => setF({ ...f, duracion_minutos: parseInt(e.target.value)||0 })} /></div>
        <div><Label>Máximo de errores permitidos</Label><Input type="number" value={f.max_errores} onChange={(e) => setF({ ...f, max_errores: parseInt(e.target.value)||0 })} /></div>
        <SenalesSwitch clase={cfg.clase} />
        <PreguntasClaseDialog clase={cfg.clase} />

        <VistaPreviaDialog clase={cfg.clase} cfg={f} orden={orden} setOrden={setOrden} />

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">Guardar</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Confirmar cambios — Clase {cfg.clase}</DialogTitle>
              <DialogDescription>Revisá el resumen antes de guardar la configuración.</DialogDescription>
            </DialogHeader>

            {sinCambios ? (
              <p className="text-sm text-muted-foreground">No hay cambios respecto de la última configuración guardada.</p>
            ) : (
              <div className="space-y-4">
                {cambiosCfg.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Parámetros</p>
                    {cambiosCfg.map((c) => (
                      <div key={c.label} className="flex items-center justify-between rounded border p-2 text-sm">
                        <span>{c.label}</span>
                        <span className="tabular-nums"><span className="text-muted-foreground line-through">{c.de}</span> → <span className="font-semibold">{c.a}</span></span>
                      </div>
                    ))}
                  </div>
                )}

                {(agregadas.length > 0 || quitadas.length > 0) && (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Preguntas incluidas en el examen</p>
                    {agregadas.map((p: any) => (
                      <div key={p.id} className="flex items-start gap-2 rounded border border-primary/40 bg-primary/5 p-2 text-sm">
                        <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{p.pregunta}</span>
                      </div>
                    ))}
                    {quitadas.map((p) => (
                      <div key={p.id} className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-2 text-sm">
                        <Minus className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span>{p.pregunta}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between rounded border p-2 text-sm">
                      <span>Puntaje total del banco activo</span>
                      <span className="tabular-nums"><span className="text-muted-foreground line-through">{puntajeDe}</span> → <span className="font-semibold">{puntajeA}</span></span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
              <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
                {mut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Confirmar y guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/** Listado de preguntas de la clase, con switch para incluirlas o excluirlas del examen. */
function PreguntasClaseDialog({ clase }: { clase: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const preguntas = useQuery({
    queryKey: ["preguntas-clase", clase],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, pregunta, respuesta_correcta, activa, eliminatoria, opciones_incorrectas, topics(nombre)")
        .eq("clase", clase as any)
        .order("pregunta");
      if (error) throw error;
      return data as any[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => {
      const { error } = await supabase.from("questions").update({ activa }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["preguntas-clase", clase] });
      qc.invalidateQueries({ queryKey: ["activas-clase", clase] });
      qc.invalidateQueries({ queryKey: ["preview-clase", clase] });
      qc.invalidateQueries({ queryKey: ["questions"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const lista = (preguntas.data ?? []).filter((p) => !search || p.pregunta.toLowerCase().includes(search.toLowerCase()));
  const activas = (preguntas.data ?? []).filter((p) => p.activa).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full"><ListChecks className="mr-1 h-4 w-4" />Ver preguntas de la clase</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preguntas de la Clase {clase}</DialogTitle>
          <DialogDescription>
            Solo se muestran preguntas cargadas con esta clase. Activá o desactivá cada una para definir si puede salir en el examen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input placeholder="Buscar pregunta..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="text-sm text-muted-foreground">
            {preguntas.isLoading ? "Cargando..." : `${activas} activa(s) de ${(preguntas.data ?? []).length} pregunta(s) en la clase`}
          </div>
          {preguntas.isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          <div className="space-y-2">
            {lista.map((p) => {
              const faltanOpciones = ((p.opciones_incorrectas ?? []) as string[]).filter(Boolean).length < 3;
              return (
                <div key={p.id} className="flex items-start justify-between gap-3 rounded border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap gap-1">
                      {p.topics?.nombre && <Badge variant="outline">{p.topics.nombre}</Badge>}
                      {p.eliminatoria && <Badge className="bg-destructive text-destructive-foreground">Eliminatoria</Badge>}
                      {faltanOpciones && <Badge variant="secondary"><AlertTriangle className="mr-1 h-3 w-3" />Sin 3 opciones</Badge>}
                    </div>
                    <p className="text-sm font-medium">{p.pregunta}</p>
                    {esSenal(p.respuesta_correcta) ? (
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><span className="font-semibold">R:</span> <SenalImg src={p.respuesta_correcta} className="h-14 w-14" /></div>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold">R:</span> {p.respuesta_correcta}</p>
                    )}

                  </div>
                  <Switch checked={!!p.activa} onCheckedChange={(v) => toggle.mutate({ id: p.id, activa: v })} />
                </div>
              );
            })}
            {!preguntas.isLoading && lista.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">No hay preguntas para esta clase.</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Vista previa del examen: resumen de la configuración sin guardar + preguntas activas reordenables. */
function VistaPreviaDialog({
  clase,
  cfg,
  orden,
  setOrden,
}: {
  clase: string;
  cfg: Cfg;
  orden: string[];
  setOrden: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const preguntas = useQuery({
    queryKey: ["preview-clase", clase],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, pregunta, respuesta_correcta, opciones_incorrectas, eliminatoria, peso, topics(nombre)")
        .eq("clase", clase as any)
        .eq("activa", true)
        .order("pregunta");
      if (error) throw error;
      return data as any[];
    },
  });

  const disponibles = useMemo(() => {
    const base = preguntas.data ?? [];
    if (orden.length === 0) return base;
    const pos = new Map(orden.map((id, i) => [id, i]));
    return [...base].sort((a, b) => (pos.get(a.id) ?? 9999) - (pos.get(b.id) ?? 9999));
  }, [preguntas.data, orden]);

  const seleccionadas = disponibles.slice(0, cfg.cantidad_preguntas);
  const puntajeTotal = seleccionadas.reduce((a, p) => a + (p.peso ?? 1), 0);
  const aciertosMin = Math.max(0, cfg.cantidad_preguntas - cfg.max_errores);
  const faltan = Math.max(0, cfg.cantidad_preguntas - disponibles.length);

  const mover = (i: number, dir: -1 | 1) => {
    const ids = disponibles.map((p) => p.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setOrden(ids);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full"><Eye className="mr-1 h-4 w-4" />Vista previa del examen</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vista previa — Clase {clase}</DialogTitle>
          <DialogDescription>
            Así quedaría el examen con la configuración actual (todavía sin guardar). Podés reordenar las preguntas con las flechas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Preguntas</div><div className="text-lg font-semibold">{seleccionadas.length} / {cfg.cantidad_preguntas}</div></div>
          <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Duración</div><div className="text-lg font-semibold">{cfg.duracion_minutos} min</div></div>
          <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Máx. errores</div><div className="text-lg font-semibold">{cfg.max_errores}</div></div>
          <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Puntaje total</div><div className="text-lg font-semibold">{puntajeTotal}</div></div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Se aprueba con al menos <span className="font-semibold text-foreground">{aciertosMin}</span> respuestas correctas. Una pregunta eliminatoria mal respondida desaprueba el examen.
          </p>
          {orden.length > 0 && <Button size="sm" variant="ghost" onClick={() => setOrden([])}>Restablecer orden</Button>}
        </div>
        {faltan > 0 && (
          <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Faltan {faltan} pregunta(s) activas en esta clase para completar el examen configurado.</span>
          </div>
        )}

        {preguntas.isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}

        <ol className="space-y-3">
          {seleccionadas.map((p, i) => {
            const opciones = [p.respuesta_correcta, ...(((p.opciones_incorrectas ?? []) as string[]).filter(Boolean))];
            return (
              <li key={p.id} className="rounded border p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap gap-1">
                      {p.topics?.nombre && <Badge variant="outline">{p.topics.nombre}</Badge>}
                      {p.eliminatoria && <Badge className="bg-destructive text-destructive-foreground">Eliminatoria</Badge>}
                      <Badge variant="secondary">Peso {p.peso ?? 1}</Badge>
                    </div>
                    <p className="text-sm font-medium">{i + 1}. {p.pregunta}</p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {opciones.map((o, j) => (
                        <li key={j} className={j === 0 ? "text-sm font-semibold text-primary" : "text-sm text-muted-foreground"}>
                          {esSenal(o) ? (
                            <span className={j === 0 ? "inline-block rounded-md ring-2 ring-primary" : "inline-block"}>
                              <SenalImg src={o} className="h-20 w-20" />
                            </span>
                          ) : (
                            <>{String.fromCharCode(65 + j)}. {o}{j === 0 ? " (correcta)" : ""}</>
                          )}
                        </li>
                      ))}
                    </ul>

                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button size="icon" variant="outline" aria-label="Subir pregunta" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="outline" aria-label="Bajar pregunta" disabled={i === seleccionadas.length - 1} onClick={() => mover(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  </div>
                </div>
              </li>
            );
          })}
          {!preguntas.isLoading && seleccionadas.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">No hay preguntas activas para esta clase.</div>
          )}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

/** Activa o desactiva en bloque las preguntas de señales de tránsito de la clase. */
function SenalesSwitch({ clase }: { clase: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["senales-clase", clase],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, activa, topics!inner(slug)")
        .eq("clase", clase as any)
        .eq("topics.slug", "senales");
      if (error) throw error;
      return data as any[];
    },
  });

  const lista = q.data ?? [];
  const activas = lista.filter((p) => p.activa).length;

  const setAll = useMutation({
    mutationFn: async (activa: boolean) => {
      const ids = lista.map((p) => p.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from("questions").update({ activa }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Señales actualizadas");
      qc.invalidateQueries({ queryKey: ["senales-clase", clase] });
      qc.invalidateQueries({ queryKey: ["activas-clase", clase] });
      qc.invalidateQueries({ queryKey: ["preview-clase", clase] });
      qc.invalidateQueries({ queryKey: ["preguntas-clase", clase] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex items-start justify-between gap-3 rounded border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Señales de tránsito</p>
        <p className="text-xs text-muted-foreground">
          {lista.length === 0 ? "Sin señales cargadas para esta clase" : `${activas} de ${lista.length} incluidas en el examen`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <SenalesDetalleDialog clase={clase} />
        <Switch
          disabled={lista.length === 0 || setAll.isPending}
          checked={lista.length > 0 && activas === lista.length}
          onCheckedChange={(v) => setAll.mutate(v)}
        />
      </div>
    </div>
  );
}

/**
 * Selección fina de señales: permite marcar o desmarcar cada señal de la clase
 * y agregar (copiar) señales de cualquier otra clase a este examen.
 */
function SenalesDetalleDialog({ clase }: { clase: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["senales-detalle"] });
    qc.invalidateQueries({ queryKey: ["senales-clase", clase] });
    qc.invalidateQueries({ queryKey: ["senales-admin"] });
    qc.invalidateQueries({ queryKey: ["activas-clase", clase] });
    qc.invalidateQueries({ queryKey: ["preview-clase", clase] });
    qc.invalidateQueries({ queryKey: ["preguntas-clase", clase] });
  };

  const todas = useQuery({
    queryKey: ["senales-detalle"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, clase, pregunta, respuesta_correcta, opciones_incorrectas, activa, eliminatoria, peso, topic_id, orden")
        .like("respuesta_correcta", "/senales/%")
        .order("clase")
        .order("orden");
      if (error) throw error;
      return data as any[];
    },
  });

  const propias = (todas.data ?? []).filter((s) => s.clase === clase);
  const otras = (todas.data ?? []).filter((s) => s.clase !== clase);

  const toggle = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => {
      const { error } = await supabase.from("questions").update({ activa }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error((e as Error).message),
  });

  /** Marca o desmarca una señal como eliminatoria. */
  const toggleElim = useMutation({
    mutationFn: async ({ id, eliminatoria }: { id: string; eliminatoria: boolean }) => {
      const { error } = await supabase.from("questions").update({ eliminatoria }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Señal actualizada."); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const agregar = useMutation({
    mutationFn: async (s: any) => {
      const { error } = await supabase.from("questions").insert({
        clase: clase as any,
        topic_id: s.topic_id,
        pregunta: s.pregunta,
        respuesta_correcta: s.respuesta_correcta,
        opciones_incorrectas: s.opciones_incorrectas ?? [],
        respuestas_aceptadas: [],
        activa: true,
        eliminatoria: s.eliminatoria,
        peso: s.peso ?? 1,
        nivel: "medio",
        orden: propias.length + 1,
        opciones_revisadas: ((s.opciones_incorrectas ?? []) as string[]).filter(Boolean).length >= 3,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Señal agregada a la clase."); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const yaEsta = (s: any) => propias.some((p) => p.respuesta_correcta === s.respuesta_correcta);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">Detalle</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Señales de la Clase {clase}</DialogTitle>
          <DialogDescription>
            Marcá o desmarcá cada señal de esta clase, definí cuáles son eliminatorias, o agregá señales de otras
            clases si el examen las necesita.
          </DialogDescription>
        </DialogHeader>

        {todas.isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}

        <div className="space-y-2">
          {propias.map((s) => (
            <div key={s.id} className="flex flex-wrap items-start gap-3 rounded border p-3">
              <SenalImg src={s.respuesta_correcta} className="h-16 w-16 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{s.pregunta}</p>
                {s.eliminatoria && <Badge className="mt-1 bg-destructive text-destructive-foreground">Eliminatoria</Badge>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">En el examen</Label>
                  <Switch checked={!!s.activa} onCheckedChange={(v) => toggle.mutate({ id: s.id, activa: v })} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Eliminatoria</Label>
                  <Switch checked={!!s.eliminatoria} onCheckedChange={(v) => toggleElim.mutate({ id: s.id, eliminatoria: v })} />
                </div>
              </div>
            </div>
          ))}
          {!todas.isLoading && propias.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Esta clase no tiene señales cargadas.</p>
          )}
        </div>

        {otras.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Agregar señales de otras clases</p>
            {otras.map((s) => (
              <div key={s.id} className="flex items-start gap-3 rounded border p-3">
                <SenalImg src={s.respuesta_correcta} className="h-14 w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Badge variant="secondary" className="mb-1">Clase {s.clase}</Badge>
                  <p className="text-sm">{s.pregunta}</p>
                </div>
                <Button size="sm" variant="outline" disabled={yaEsta(s) || agregar.isPending}
                  onClick={() => agregar.mutate(s)}>
                  {yaEsta(s) ? "Ya incluida" : <><Plus className="mr-1 h-4 w-4" />Agregar</>}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
