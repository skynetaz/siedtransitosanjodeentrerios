import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { ListChecks, Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/configuracion")({ component: Config });

const CLASES = ["UNICA","A","B","C","D","E"] as const;

function Config() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["exam-configs"], queryFn: async () => (await supabase.from("exam_configs").select("*")).data ?? [] });
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle>Configuración de exámenes por clase</CardTitle><CardDescription>Cantidad de preguntas, duración y máximo de errores permitidos. Con "Ver preguntas de la clase" podés revisar y marcar cuáles entran en el examen.</CardDescription></CardHeader></Card>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CLASES.map((c) => {
          const cfg = (q.data ?? []).find((x: any) => x.clase === c) as any;
          return cfg && <ConfigCard key={c} cfg={cfg} onSaved={() => qc.invalidateQueries({ queryKey: ["exam-configs"] })} />;
        })}
      </div>
    </div>
  );
}

function ConfigCard({ cfg, onSaved }: { cfg: any; onSaved: () => void }) {
  const [f, setF] = useState({ cantidad_preguntas: cfg.cantidad_preguntas, duracion_minutos: cfg.duracion_minutos, max_errores: cfg.max_errores });
  useEffect(() => setF({ cantidad_preguntas: cfg.cantidad_preguntas, duracion_minutos: cfg.duracion_minutos, max_errores: cfg.max_errores }), [cfg]);
  const mut = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("exam_configs").update(f).eq("clase", cfg.clase); if (error) throw error; },
    onSuccess: () => { toast.success("Configuración actualizada"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Clase {cfg.clase}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Cantidad de preguntas</Label><Input type="number" value={f.cantidad_preguntas} onChange={(e) => setF({ ...f, cantidad_preguntas: parseInt(e.target.value)||0 })} /></div>
        <div><Label>Duración (minutos)</Label><Input type="number" value={f.duracion_minutos} onChange={(e) => setF({ ...f, duracion_minutos: parseInt(e.target.value)||0 })} /></div>
        <div><Label>Máximo de errores permitidos</Label><Input type="number" value={f.max_errores} onChange={(e) => setF({ ...f, max_errores: parseInt(e.target.value)||0 })} /></div>
        <PreguntasClaseDialog clase={cfg.clase} />
        <VistaPreviaDialog clase={cfg.clase} cfg={f} />
        <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full">Guardar</Button>
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["preguntas-clase", clase] }); qc.invalidateQueries({ queryKey: ["questions"] }); },
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
                    <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold">R:</span> {p.respuesta_correcta}</p>
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
