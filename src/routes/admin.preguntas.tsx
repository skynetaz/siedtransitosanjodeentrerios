import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/preguntas")({ component: Preguntas });

type Q = {
  id: string; clase: string; pregunta: string; respuesta_correcta: string;
  respuestas_aceptadas: string[]; eliminatoria: boolean; peso: number; nivel: string;
  activa: boolean; topic_id: string | null;
};

function Preguntas() {
  const qc = useQueryClient();
  const [filterClase, setFilterClase] = useState<string>("all");
  const [filterTopic, setFilterTopic] = useState<string>("all");
  const [search, setSearch] = useState("");

  const topics = useQuery({ queryKey: ["topics"], queryFn: async () => (await supabase.from("topics").select("*").order("nombre")).data ?? [] });
  const questions = useQuery({
    queryKey: ["questions", filterClase, filterTopic],
    queryFn: async () => {
      let q = supabase.from("questions").select("*, topics(nombre)").order("fuente");
      if (filterClase !== "all") q = q.eq("clase", filterClase as any);
      if (filterTopic !== "all") q = q.eq("topic_id", filterTopic);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = (questions.data ?? []).filter((q) =>
    !search || q.pregunta.toLowerCase().includes(search.toLowerCase()) || q.respuesta_correcta.toLowerCase().includes(search.toLowerCase())
  );

  const delMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("questions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Pregunta eliminada"); qc.invalidateQueries({ queryKey: ["questions"] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Clase</Label>
            <Select value={filterClase} onValueChange={setFilterClase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {["UNICA","A","B","C","D","E"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tema</Label>
            <Select value={filterTopic} onValueChange={setFilterTopic}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(topics.data ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Buscar</Label>
            <Input placeholder="Texto de la pregunta o respuesta" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">{filtered.length} pregunta(s)</div>
        <QuestionDialog topics={topics.data ?? []} trigger={<Button><Plus className="mr-1 h-4 w-4" />Nueva pregunta</Button>} />
      </div>

      <div className="space-y-2">
        {filtered.map((q: any) => (
          <Card key={q.id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1 mb-2">
                    <Badge variant="secondary">Clase {q.clase}</Badge>
                    {q.topics?.nombre && <Badge variant="outline">{q.topics.nombre}</Badge>}
                    {q.eliminatoria && <Badge className="bg-destructive text-destructive-foreground"><AlertTriangle className="mr-1 h-3 w-3" />Eliminatoria</Badge>}
                    {!q.activa && <Badge variant="outline">Inactiva</Badge>}
                    <Badge variant="outline">Peso {q.peso}</Badge>
                  </div>
                  <p className="font-medium">{q.pregunta}</p>
                  <p className="text-sm text-muted-foreground mt-1"><span className="font-semibold">R:</span> {q.respuesta_correcta}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <QuestionDialog topics={topics.data ?? []} question={q} trigger={<Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>} />
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar esta pregunta?")) delMut.mutate(q.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <div className="text-center text-muted-foreground py-8">No hay preguntas.</div>}
      </div>
    </div>
  );
}

function QuestionDialog({ topics, question, trigger }: { topics: any[]; question?: Q; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Partial<Q>>(question ?? { clase: "B", eliminatoria: false, peso: 1, nivel: "medio", activa: true, respuestas_aceptadas: [] });
  const [aceptadasText, setAceptadasText] = useState((question?.respuestas_aceptadas ?? []).join("\n"));
  const [incorrectasText, setIncorrectasText] = useState(((question as any)?.opciones_incorrectas ?? []).join("\n"));
  const mut = useMutation({
    mutationFn: async () => {
      const incorrectas = incorrectasText.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3);
      const payload = {
        ...f,
        respuestas_aceptadas: aceptadasText.split("\n").map((s) => s.trim()).filter(Boolean),
        opciones_incorrectas: incorrectas,
        opciones_revisadas: incorrectas.length >= 3,
      };
      if (question?.id) {
        const { error } = await supabase.from("questions").update(payload as any).eq("id", question.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("questions").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(question ? "Pregunta actualizada" : "Pregunta creada"); qc.invalidateQueries({ queryKey: ["questions"] }); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{question ? "Editar" : "Nueva"} pregunta</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label>Clase</Label>
              <Select value={f.clase} onValueChange={(v) => setF({ ...f, clase: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["UNICA","A","B","C","D","E"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Tema</Label>
              <Select value={f.topic_id ?? undefined} onValueChange={(v) => setF({ ...f, topic_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sin tema" /></SelectTrigger>
                <SelectContent>{topics.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nivel</Label>
              <Select value={f.nivel} onValueChange={(v) => setF({ ...f, nivel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["facil","medio","dificil"].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Pregunta</Label><Textarea rows={3} value={f.pregunta ?? ""} onChange={(e) => setF({ ...f, pregunta: e.target.value })} /></div>
          <div><Label>Respuesta correcta</Label><Textarea rows={2} value={f.respuesta_correcta ?? ""} onChange={(e) => setF({ ...f, respuesta_correcta: e.target.value })} /></div>
          <div>
            <Label>Respuestas también aceptadas (una por línea)</Label>
            <Textarea rows={3} value={aceptadasText} onChange={(e) => setAceptadasText(e.target.value)} placeholder="Variantes válidas..." />
          </div>
          <div>
            <Label>Opciones incorrectas para multiple choice (una por línea, hasta 3)</Label>
            <Textarea rows={3} value={incorrectasText} onChange={(e) => setIncorrectasText(e.target.value)} placeholder="Distractores que verá el aspirante..." />
            <p className="mt-1 text-xs text-muted-foreground">Se mezclan con la respuesta correcta al armar el examen.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between rounded border p-3">
              <div><Label className="font-medium">Eliminatoria</Label><p className="text-xs text-muted-foreground">Si se equivoca, desaprueba.</p></div>
              <Switch checked={!!f.eliminatoria} onCheckedChange={(v) => setF({ ...f, eliminatoria: v })} />
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <div><Label className="font-medium">Activa</Label><p className="text-xs text-muted-foreground">Disponible en exámenes.</p></div>
              <Switch checked={f.activa !== false} onCheckedChange={(v) => setF({ ...f, activa: v })} />
            </div>
            <div><Label>Peso</Label><Input type="number" min={1} max={10} value={f.peso ?? 1} onChange={(e) => setF({ ...f, peso: parseInt(e.target.value) || 1 })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
