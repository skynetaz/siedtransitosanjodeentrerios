import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarCategorias, guardarCategoria, eliminarCategoria, previsualizarCategoria } from "@/lib/categorias.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Save, Pencil, Eye, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmarBorrado } from "@/components/ConfirmarBorrado";
import { esSenal, SenalImg } from "@/components/exam/ExamPieces";


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
                  <VistaPrevia cat={c} />

                  <ConfirmarBorrado
                    titulo="¿Eliminar esta categoría de examen?"
                    detalle={`Se quitará "${c.nombre}" de las categorías disponibles.`}
                    onConfirm={() => del.mutate(c.slug)}
                    trigger={
                      <Button variant="ghost" size="sm" className="h-10 text-destructive">
                        <Trash2 className="mr-1 h-4 w-4" />Eliminar
                      </Button>
                    }
                  />
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

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-12 flex-1" onClick={onCancel}>Cancelar</Button>
          <VistaPrevia cat={form} className="h-12 flex-1" />
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

/** Texto normalizado para detectar preguntas repetidas. */
function claveTexto(s: string) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Preg = {
  orden: number; id: string; clase: string; tema: string | null; pregunta: string;
  eliminatoria: boolean; activa?: boolean; peso: number; correcta: string; opciones: string[];
};

/** Diálogo de vista previa con edición de las preguntas de la categoría. */
function VistaPrevia({ cat, className }: { cat: Cat; className?: string }) {
  const [open, setOpen] = useState(false);
  const previsualizar = useServerFn(previsualizarCategoria);
  const listarSel = useServerFn(listarPreguntasCategoria);
  const guardarSel = useServerFn(guardarPreguntasCategoria);
  const qc = useQueryClient();

  // ids === null → armado automático; array → selección propia (en edición).
  const [ids, setIds] = useState<string[] | null>(null);
  const [originales, setOriginales] = useState<string[] | null>(null);
  const [cargado, setCargado] = useState(false);

  const guardada = useQuery({
    queryKey: ["categoria-preguntas", cat.slug],
    queryFn: () => listarSel({ data: { slug: cat.slug } }),
    enabled: open && !!cat.slug,
  });

  // Al abrir, tomo la selección guardada (si hay).
  if (open && !cargado && cat.slug && guardada.isSuccess) {
    const g = (guardada.data as string[]) ?? [];
    setIds(g.length ? g : null);
    setOriginales(g.length ? g : null);
    setCargado(true);
  }
  if (open && !cargado && !cat.slug) setCargado(true);

  const q = useQuery({
    queryKey: ["preview-categoria", cat.slug, cat.clases.join(","), cat.cantidad_preguntas, cat.preguntas_senales, cat.incluye_senales, ids?.join(",") ?? "auto"],
    queryFn: () =>
      previsualizar({
        data: { ...cat, slug: cat.slug || "preview", nombre: cat.nombre || "Vista previa", ids: ids ?? null },
      }),
    enabled: open && cargado && cat.clases.length > 0,
  });
  const d = q.data as any;
  const preguntas: Preg[] = (d?.preguntas ?? []) as Preg[];

  // Detector de repetidas: mismo texto (o misma respuesta correcta) dentro de la categoría.
  const conteoTexto = new Map<string, number>();
  const conteoResp = new Map<string, number>();
  for (const p of preguntas) {
    const k = claveTexto(p.pregunta);
    conteoTexto.set(k, (conteoTexto.get(k) ?? 0) + 1);
    const r = `${k}::${claveTexto(p.correcta)}`;
    conteoResp.set(r, (conteoResp.get(r) ?? 0) + 1);
  }
  const esRepetida = (p: Preg) => (conteoTexto.get(claveTexto(p.pregunta)) ?? 0) > 1;
  const repetidas = preguntas.filter(esRepetida);
  const gruposRepetidos = new Set(repetidas.map((p) => claveTexto(p.pregunta))).size;

  const manual = ids !== null;
  const pasarAManual = () => setIds(preguntas.map((p) => p.id));
  const quitar = (id: string) => setIds((prev) => (prev ?? preguntas.map((p) => p.id)).filter((x) => x !== id));
  const mover = (i: number, dir: -1 | 1) =>
    setIds((prev) => {
      const arr = [...(prev ?? preguntas.map((p) => p.id))];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      return arr;
    });
  const agregar = (nuevos: string[]) =>
    setIds((prev) => {
      const base = prev ?? preguntas.map((p) => p.id);
      return [...base, ...nuevos.filter((n) => !base.includes(n))];
    });
  /** Deja una sola copia de cada pregunta repetida (la primera). */
  const quitarRepetidas = () => {
    const vistos = new Set<string>();
    const limpio: string[] = [];
    for (const p of preguntas) {
      const k = claveTexto(p.pregunta);
      if (vistos.has(k)) continue;
      vistos.add(k);
      limpio.push(p.id);
    }
    setIds(limpio);
  };

  const mut = useMutation({
    mutationFn: async () => await guardarSel({ data: { slug: cat.slug, ids: ids ?? [] } }),
    onSuccess: () => {
      toast.success("Selección de preguntas guardada para esta categoría.");
      setOriginales(ids);
      qc.invalidateQueries({ queryKey: ["categoria-preguntas", cat.slug] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const hayCambios = (originales ?? []).join(",") !== (ids ?? []).join(",");
  const agregadas = (ids ?? []).filter((x) => !(originales ?? []).includes(x)).length;
  const quitadas = (originales ?? []).filter((x) => !(ids ?? []).includes(x)).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) { setCargado(false); setIds(null); setOriginales(null); }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className ?? "h-10"}>
          <Eye className="mr-1 h-4 w-4" />Vista previa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Vista previa · {cat.nombre || "Sin nombre"}</DialogTitle>
          <DialogDescription>
            Clases {cat.clases.join(" + ")} · {cat.duracion_minutos} min · hasta {cat.max_errores} errores.
            {manual ? " Selección propia de esta categoría." : " Armado automático (aleatorio)."}
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        ) : q.error ? (
          <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        ) : d ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Dato label="Preguntas" valor={`${preguntas.length}${manual ? "" : ` / ${d.solicitadas}`}`} />
              <Dato label="De señales" valor={String(d.senalesIncluidas)} />
              <Dato label="Eliminatorias" valor={String(d.eliminatorias)} />
              <Dato label="Puntaje total" valor={String(d.puntaje)} />
            </div>

            {!manual && preguntas.length < d.solicitadas && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>Faltan preguntas activas: hay {d.disponibles} disponibles para estas clases.</span>
              </div>
            )}

            {gruposRepetidos > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
                <Copy className="h-4 w-4 shrink-0 text-warning-foreground" />
                <span className="flex-1 min-w-40">
                  <strong>{gruposRepetidos}</strong> pregunta(s) repetida(s) en esta categoría
                  ({repetidas.length} apariciones). Están marcadas abajo.
                </span>
                {cat.slug && (
                  <Button size="sm" variant="outline" className="h-9" onClick={quitarRepetidas}>
                    Dejar una sola copia
                  </Button>
                )}
              </div>
            )}

            {cat.slug && (
              <div className="flex flex-wrap gap-2 rounded-lg border p-3">
                {manual ? (
                  <>
                    <BancoDialog yaIncluidas={ids ?? []} clasesCategoria={cat.clases} onAgregar={agregar} />
                    <Button variant="ghost" size="sm" className="h-10" onClick={() => setIds(originales)}>
                      Restaurar
                    </Button>
                    <Button
                      size="sm"
                      className="h-10"
                      disabled={!hayCambios || mut.isPending}
                      onClick={() => mut.mutate()}
                    >
                      {mut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                      Guardar selección
                    </Button>
                    {hayCambios && (
                      <span className="self-center text-xs text-muted-foreground">
                        +{agregadas} agregada(s) · −{quitadas} quitada(s)
                      </span>
                    )}
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="h-10" onClick={pasarAManual}>
                    <Pencil className="mr-1 h-4 w-4" />Editar preguntas de esta categoría
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-3">
              {preguntas.map((p, i) => (
                <div key={p.id} className={`rounded-lg border p-3 ${esRepetida(p) ? "border-warning bg-warning/5" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Clase {p.clase}</Badge>
                    {p.tema && <span>{p.tema}</span>}
                    <span>· peso {p.peso}</span>
                    {p.eliminatoria && <Badge className="bg-destructive text-destructive-foreground">Eliminatoria</Badge>}
                    {esRepetida(p) && <Badge className="bg-warning text-warning-foreground">Repetida</Badge>}
                    {manual && (
                      <span className="ml-auto flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => mover(i, -1)} disabled={i === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => mover(i, 1)} disabled={i === preguntas.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => quitar(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium">{i + 1}. {p.pregunta}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.opciones.map((o: string, k: number) => {
                      const ok = o === p.correcta;
                      return esSenal(o) ? (
                        <div key={k} className={ok ? "rounded-md ring-2 ring-success" : ""}>
                          <SenalImg src={o} className="h-16 w-16" />
                        </div>
                      ) : (
                        <span key={k} className={`rounded-md border px-2 py-1 text-xs ${ok ? "border-success bg-success/10 font-semibold" : ""}`}>
                          {o}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
              {preguntas.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No hay preguntas seleccionadas.</p>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Buscador del banco de preguntas para agregar a la categoría. */
function BancoDialog({
  yaIncluidas, clasesCategoria, onAgregar,
}: { yaIncluidas: string[]; clasesCategoria: Clase[]; onAgregar: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [clase, setClase] = useState<string>("cat");
  const [tema, setTema] = useState<string>("all");
  const [sel, setSel] = useState<string[]>([]);
  const banco = useServerFn(listarBancoPreguntas);
  const temasFn = useServerFn(listarTemas);

  const temas = useQuery({ queryKey: ["temas"], queryFn: () => temasFn(), enabled: open });
  const q = useQuery({
    queryKey: ["banco-preguntas", clase, tema, texto, clasesCategoria.join(",")],
    queryFn: () =>
      banco({
        data: {
          clases: clase === "cat" ? clasesCategoria : clase === "all" ? [] : [clase as Clase],
          topicId: tema === "all" ? null : tema,
          texto,
          soloActivas: true,
          limite: 300,
        },
      }),
    enabled: open,
  });
  const rows: Preg[] = (q.data ?? []) as Preg[];

  const confirmar = () => { onAgregar(sel); setSel([]); setOpen(false); };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSel([]); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-10">
          <Plus className="mr-1 h-4 w-4" />Agregar del banco de preguntas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Banco de preguntas</DialogTitle>
          <DialogDescription>Marcá las preguntas que querés sumar a esta categoría.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select value={clase} onValueChange={setClase}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cat">Clases de la categoría</SelectItem>
              <SelectItem value="all">Todas las clases</SelectItem>
              {CLASES.map((c) => <SelectItem key={c} value={c}>Clase {c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tema} onValueChange={setTema}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Tema" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los temas</SelectItem>
              {((temas.data ?? []) as any[]).map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="h-11" placeholder="Buscar texto..." value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>

        {q.isLoading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        ) : (
          <div className="space-y-2">
            {rows.map((p) => {
              const incluida = yaIncluidas.includes(p.id);
              const marcada = sel.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={incluida}
                  onClick={() => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                  className={`w-full rounded-lg border p-3 text-left text-sm ${incluida ? "opacity-50" : marcada ? "border-primary bg-primary/10" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Clase {p.clase}</Badge>
                    {p.tema && <span>{p.tema}</span>}
                    {p.eliminatoria && <Badge className="bg-destructive text-destructive-foreground">Eliminatoria</Badge>}
                    {incluida && <Badge variant="secondary">Ya incluida</Badge>}
                  </div>
                  <p className="mt-1 font-medium">{p.pregunta}</p>
                </button>
              );
            })}
            {rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados.</p>}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="h-12 flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button className="h-12 flex-1" disabled={sel.length === 0} onClick={confirmar}>
            Agregar {sel.length > 0 ? `(${sel.length})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-bold">{valor}</p>
    </div>
  );
}
