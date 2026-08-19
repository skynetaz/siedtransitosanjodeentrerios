import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarCategorias, guardarCategoria, eliminarCategoria } from "@/lib/categorias.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Save, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/categorias")({ component: CategoriasPage });

const CLASES = ["UNICA", "A", "B", "C", "D", "E"] as const;
type Clase = (typeof CLASES)[number];

type Cat = {
  slug: string; nombre: string; tipo: "principiante" | "anexo_caduco";
  grupo: "particular" | "profesional"; clases: Clase[];
  incluye_senales: boolean; preguntas_senales: number; cantidad_preguntas: number;
  duracion_minutos: number; max_errores: number; activa: boolean; orden: number;
};

const NUEVA: Cat = {
  slug: "", nombre: "", tipo: "principiante", grupo: "particular", clases: ["UNICA"],
  incluye_senales: true, preguntas_senales: 5, cantidad_preguntas: 20,
  duracion_minutos: 15, max_errores: 4, activa: true, orden: 0,
};

const TIPOS: Record<string, string> = { principiante: "Principiante", anexo_caduco: "Anexo / Caduco" };

function CategoriasPage() {
  const qc = useQueryClient();
  const listar = useServerFn(listarCategorias);
  const borrar = useServerFn(eliminarCategoria);
  const [editando, setEditando] = useState<Cat | null>(null);

  const q = useQuery({ queryKey: ["categorias"], queryFn: () => listar() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["categorias"] });

  const del = useMutation({
    mutationFn: async (slug: string) => await borrar({ data: { slug } }),
    onSuccess: () => { toast.success("Categoría eliminada."); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-xl font-bold">Categorías de examen</h2>
          <p className="text-sm text-muted-foreground">
            Cada categoría arma un único examen combinado (clases incluidas + señales de tránsito).
          </p>
        </div>
        <Button className="h-11 shrink-0" onClick={() => setEditando({ ...NUEVA })}>
          <Plus className="mr-1 h-4 w-4" />Nueva
        </Button>
      </div>

      {editando && (
        <Editor
          value={editando}
          onCancel={() => setEditando(null)}
          onSaved={() => { setEditando(null); invalidate(); }}
        />
      )}

      {q.isLoading ? (
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      ) : (
        <div className="space-y-3">
          {((q.data ?? []) as Cat[]).map((c) => (
            <Card key={c.slug}>
              <CardContent className="space-y-2 py-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {TIPOS[c.tipo]} · {c.grupo === "profesional" ? "Profesional" : "Particular"} · clases {c.clases.join(" + ")}
                      {c.incluye_senales ? ` + ${c.preguntas_senales} de señales` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.cantidad_preguntas} preguntas · {c.duracion_minutos} min · hasta {c.max_errores} errores
                    </p>
                  </div>
                  <Badge className={c.activa ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                    {c.activa ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="outline" size="sm" className="h-10" onClick={() => setEditando({ ...c })}>
                    <Pencil className="mr-1 h-4 w-4" />Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="h-10 text-destructive" onClick={() => del.mutate(c.slug)}>
                    <Trash2 className="mr-1 h-4 w-4" />Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Editor({ value, onCancel, onSaved }: { value: Cat; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Cat>(value);
  const guardar = useServerFn(guardarCategoria);
  const mut = useMutation({
    mutationFn: async () => await guardar({ data: form }),
    onSuccess: () => { toast.success("Categoría guardada."); onSaved(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const set = (patch: Partial<Cat>) => setForm({ ...form, ...patch });
  const toggleClase = (c: Clase) =>
    set({ clases: form.clases.includes(c) ? form.clases.filter((x) => x !== c) : [...form.clases, c] });

  return (
    <Card className="border-primary/50">
      <CardHeader>
        <CardTitle className="text-lg">{value.slug ? "Editar categoría" : "Nueva categoría"}</CardTitle>
        <CardDescription>El aspirante rinde un solo examen con todas las clases marcadas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Identificador</Label>
            <Input className="h-12" placeholder="prin-ab" value={form.slug} disabled={!!value.slug}
              onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre visible</Label>
            <Input className="h-12" value={form.nombre} onChange={(e) => set({ nombre: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de trámite</Label>
            <Select value={form.tipo} onValueChange={(v) => set({ tipo: v as Cat["tipo"] })}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="principiante">Principiante</SelectItem>
                <SelectItem value="anexo_caduco">Anexo / Caduco</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Grupo</Label>
            <Select value={form.grupo} onValueChange={(v) => set({ grupo: v as Cat["grupo"] })}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="particular">Particular</SelectItem>
                <SelectItem value="profesional">Profesional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Clases incluidas</Label>
          <div className="flex flex-wrap gap-2">
            {CLASES.map((c) => (
              <Button key={c} type="button" variant={form.clases.includes(c) ? "default" : "outline"}
                className="h-11 min-w-14" onClick={() => toggleClase(c)}>
                {c}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Incluir señales de tránsito</p>
            <p className="text-xs text-muted-foreground">Reserva un cupo de preguntas del tema Señales.</p>
          </div>
          <Switch checked={form.incluye_senales} onCheckedChange={(v) => set({ incluye_senales: v })} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Num label="Preguntas de señales" value={form.preguntas_senales} onChange={(n) => set({ preguntas_senales: n })} />
          <Num label="Total de preguntas" value={form.cantidad_preguntas} onChange={(n) => set({ cantidad_preguntas: n })} />
          <Num label="Duración (min)" value={form.duracion_minutos} onChange={(n) => set({ duracion_minutos: n })} />
          <Num label="Máx. errores" value={form.max_errores} onChange={(n) => set({ max_errores: n })} />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <p className="text-sm font-medium">Categoría activa</p>
          <Switch checked={form.activa} onCheckedChange={(v) => set({ activa: v })} />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="h-12 flex-1" onClick={onCancel}>Cancelar</Button>
          <Button className="h-12 flex-1" disabled={!form.slug || !form.nombre || form.clases.length === 0 || mut.isPending}
            onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input className="h-12" type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}
