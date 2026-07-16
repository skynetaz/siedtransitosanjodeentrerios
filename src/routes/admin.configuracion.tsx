import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/configuracion")({ component: Config });

const CLASES = ["UNICA","A","B","C","D","E"] as const;

function Config() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["exam-configs"], queryFn: async () => (await supabase.from("exam_configs").select("*")).data ?? [] });
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle>Configuración de exámenes por clase</CardTitle><CardDescription>Cantidad de preguntas, duración y máximo de errores permitidos.</CardDescription></CardHeader></Card>
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
        <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full">Guardar</Button>
      </CardContent>
    </Card>
  );
}
