import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { ConfirmarBorrado } from "@/components/ConfirmarBorrado";
import { SenalImg } from "@/components/exam/ExamPieces";
import { SENALES_IMGS } from "@/lib/senales-catalogo";

export const Route = createFileRoute("/admin/senales")({ component: SenalesPage });

const CLASES = ["UNICA", "A", "B", "C", "D", "E"] as const;
type Clase = (typeof CLASES)[number];

type Senal = {
  id: string;
  clase: string;
  pregunta: string;
  respuesta_correcta: string;
  opciones_incorrectas: string[] | null;
  activa: boolean;
  eliminatoria: boolean;
  peso: number;
  orden: number;
  topic_id: string | null;
};

function useTopicSenales() {
  return useQuery({
    queryKey: ["topic-senales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("topics").select("id").eq("slug", "senales").maybeSingle();
      if (error) throw error;
      return data?.id as string | undefined;
    },
  });
}

function SenalesPage() {
  const [clase, setClase] = useState<Clase>("A");
  const topic = useTopicSenales();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["senales-admin"] });
    qc.invalidateQueries({ queryKey: ["senales-clase"] });
    qc.invalidateQueries({ queryKey: ["preview-clase"] });
    qc.invalidateQueries({ queryKey: ["preguntas-clase"] });
    qc.invalidateQueries({ queryKey: ["questions"] });
  };

  const q = useQuery({
    queryKey: ["senales-admin", clase],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, clase, pregunta, respuesta_correcta, opciones_incorrectas, activa, eliminatoria, peso, orden, topic_id")
        .eq("clase", clase as any)
        .like("respuesta_correcta", "/senales/%")
        .order("orden")
        .order("respuesta_correcta");
      if (error) throw error;
      return data as Senal[];
    },
  });

  const lista = q.data ?? [];

  const toggle = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => {
      const { error } = await supabase.from("questions").update({ activa }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleElim = useMutation({
    mutationFn: async ({ id, eliminatoria }: { id: string; eliminatoria: boolean }) => {
      const { error } = await supabase.from("questions").update({ eliminatoria }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Señal actualizada."); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const borrar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Señal eliminada."); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const reordenar = useMutation({
    mutationFn: async (ids: string[]) => {
      for (let i = 0; i < ids.length; i++) {
        const { error } = await supabase.from("questions").update({ orden: i + 1 }).eq("id", ids[i]);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e) => toast.error((e as Error).message),
  });

  const mover = (i: number, dir: -1 | 1) => {
    const ids = lista.map((s) => s.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reordenar.mutate(ids);
  };

  const activas = lista.filter((s) => s.activa).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Señales de tránsito por clase</CardTitle>
          <CardDescription>
            Editá el enunciado y las opciones ilustradas, reordená las señales, activá o desactivá cuáles entran al examen
            y copiá una señal a otras clases para fusionar exámenes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {CLASES.map((c) => (
              <Button key={c} variant={clase === c ? "default" : "outline"} className="h-11 min-w-14" onClick={() => setClase(c)}>
                {c}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {q.isLoading ? "Cargando..." : `${activas} activa(s) de ${lista.length} señal(es) en la clase ${clase}`}
            </p>
            <div className="flex flex-wrap gap-2">
              <SubirSenal label="Subir imagen al catálogo" />
              <SenalDialog
                clase={clase}
                topicId={topic.data}
                siguienteOrden={lista.length + 1}
                onSaved={invalidate}
                trigger={<Button className="h-11"><Plus className="mr-1 h-4 w-4" />Nueva señal</Button>}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {q.isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}

      <div className="space-y-3">
        {lista.map((s, i) => {
          const opciones = [s.respuesta_correcta, ...((s.opciones_incorrectas ?? []).filter(Boolean))];
          return (
            <Card key={s.id}>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap gap-1">
                      <Badge variant="secondary">Clase {s.clase}</Badge>
                      <Badge variant="outline">Orden {i + 1}</Badge>
                      {s.eliminatoria && <Badge className="bg-destructive text-destructive-foreground">Eliminatoria</Badge>}
                      {!s.activa && <Badge variant="outline">Inactiva</Badge>}
                    </div>
                    <p className="text-sm font-medium">{s.pregunta}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button size="icon" variant="outline" aria-label="Subir señal" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="outline" aria-label="Bajar señal" disabled={i === lista.length - 1} onClick={() => mover(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {opciones.map((o, j) => (
                    <span key={j} className={j === 0 ? "inline-block rounded-md ring-2 ring-primary" : "inline-block opacity-80"}>
                      <SenalImg src={o} className="h-20 w-20" />
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <SenalDialog
                    clase={s.clase as Clase}
                    topicId={topic.data}
                    senal={s}
                    siguienteOrden={s.orden}
                    onSaved={invalidate}
                    trigger={<Button variant="outline" size="sm" className="h-10"><Pencil className="mr-1 h-4 w-4" />Editar</Button>}
                  />
                  <CopiarDialog senal={s} onSaved={invalidate} />
                  <ConfirmarBorrado
                    titulo="¿Eliminar esta señal?"
                    detalle="La señal dejará de estar disponible para los exámenes de esta clase."
                    onConfirm={() => borrar.mutate(s.id)}
                    trigger={
                      <Button variant="ghost" size="sm" className="h-10 text-destructive">
                        <Trash2 className="mr-1 h-4 w-4" />Eliminar
                      </Button>
                    }
                  />
                  <div className="ml-auto flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Eliminatoria</Label>
                      <Switch checked={s.eliminatoria} onCheckedChange={(v) => toggleElim.mutate({ id: s.id, eliminatoria: v })} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">En el examen</Label>
                      <Switch checked={s.activa} onCheckedChange={(v) => toggle.mutate({ id: s.id, activa: v })} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!q.isLoading && lista.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">No hay señales cargadas en la clase {clase}.</div>
        )}
      </div>
    </div>
  );
}

/** Alta y edición de una señal (enunciado + imagen correcta + distractores). */
function SenalDialog({
  clase, topicId, senal, siguienteOrden, onSaved, trigger,
}: {
  clase: Clase; topicId?: string; senal?: Senal; siguienteOrden: number; onSaved: () => void; trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pregunta, setPregunta] = useState(senal?.pregunta ?? "Determine cuál de estas señales corresponde a la consigna.");
  const [correcta, setCorrecta] = useState(senal?.respuesta_correcta ?? "");
  const [incorrectas, setIncorrectas] = useState<string[]>(() => {
    const base = (senal?.opciones_incorrectas ?? []).filter(Boolean);
    return [0, 1, 2, 3].map((i) => base[i] ?? "");
  });
  const [claseDestino, setClaseDestino] = useState<Clase>(clase);
  const [copiarA, setCopiarA] = useState<Clase[]>([]);
  const [activa, setActiva] = useState(senal?.activa ?? true);
  const [eliminatoria, setEliminatoria] = useState(senal?.eliminatoria ?? false);

  const mut = useMutation({
    mutationFn: async () => {
      // Al editar NUNCA se cambia la clase: la señal debe seguir en su clase.
      const claseFinal = senal?.id ? (senal.clase as Clase) : claseDestino;
      const payload: Record<string, any> = {
        clase: claseFinal,
        topic_id: topicId ?? senal?.topic_id ?? null,
        pregunta: pregunta.trim(),
        respuesta_correcta: correcta,
        opciones_incorrectas: incorrectas.filter(Boolean),
        respuestas_aceptadas: [],
        activa,
        eliminatoria,
        peso: senal?.peso ?? 1,
        nivel: "medio",
        orden: senal?.orden ?? siguienteOrden,
        opciones_revisadas: incorrectas.filter(Boolean).length >= 3,
      };
      if (senal?.id) {
        const { error } = await supabase.from("questions").update(payload as any).eq("id", senal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("questions").insert(payload as any);
        if (error) throw error;
      }
      // Copias adicionales en otras clases (no mueve la original).
      const extra = copiarA.filter((c) => c !== claseFinal);
      if (extra.length) {
        const { error } = await supabase
          .from("questions")
          .insert(extra.map((c) => ({ ...payload, clase: c, orden: siguienteOrden })) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(senal ? "Señal actualizada." : "Señal creada."); setCopiarA([]); setOpen(false); onSaved(); },
    onError: (e) => toast.error((e as Error).message),
  });


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{senal ? "Editar señal" : "Nueva señal"}</DialogTitle>
          <DialogDescription>Elegí la imagen correcta y hasta cuatro distractores del catálogo de señales.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Consigna</Label>
            <Textarea value={pregunta} onChange={(e) => setPregunta(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{senal ? "Clase (no se modifica)" : "Clase"}</Label>
              {senal ? (
                <div className="rounded border bg-muted px-3 py-2 text-sm font-semibold">Clase {senal.clase}</div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {CLASES.map((c) => (
                    <Button key={c} type="button" size="sm" variant={claseDestino === c ? "default" : "outline"} onClick={() => setClaseDestino(c)}>{c}</Button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded border p-3">
              <Label className="text-xs">Activa</Label>
              <Switch checked={activa} onCheckedChange={setActiva} />
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <Label className="text-xs">Eliminatoria</Label>
              <Switch checked={eliminatoria} onCheckedChange={setEliminatoria} />
            </div>
          </div>

          <ImagePicker label="Imagen correcta" value={correcta} onChange={setCorrecta} />
          {incorrectas.map((v, i) => (
            <ImagePicker
              key={i}
              label={`Distractor ${i + 1}`}
              value={v}
              onChange={(nv) => setIncorrectas(incorrectas.map((x, j) => (j === i ? nv : x)))}
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!correcta || !pregunta.trim() || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Catálogo de señales subidas por el personal (almacenamiento). */
function useSenalAssets() {
  return useQuery({
    queryKey: ["senal-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("senal_assets")
        .select("id, path, url, nombre")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; path: string; url: string; nombre: string }[];
    },
  });
}

/** Subida de una imagen nueva con vista previa antes de guardar. */
function SubirSenal({ onListo, label = "Subir imagen" }: { onListo?: (url: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const qc = useQueryClient();

  const elegir = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("El archivo debe ser una imagen.");
    if (f.size > 5 * 1024 * 1024) return toast.error("La imagen no puede superar los 5 MB.");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const limpiar = () => { setFile(null); setPreview(""); };

  const mut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Elegí una imagen.");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("senales").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      const url = `/api/public/senal/${path}`;
      const { error } = await supabase.from("senal_assets").insert({
        path, url, nombre: file.name, content_type: file.type, size: file.size,
      } as any);
      if (error) throw error;
      return url;
    },
    onSuccess: (url) => {
      toast.success("Imagen guardada en el catálogo.");
      qc.invalidateQueries({ queryKey: ["senal-assets"] });
      onListo?.(url);
      limpiar();
      setOpen(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) limpiar(); }}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-10"><Upload className="mr-1 h-4 w-4" />{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir imagen de señal</DialogTitle>
          <DialogDescription>Aceptamos JPG, PNG, WEBP o SVG hasta 5 MB. La imagen se guarda en su calidad original.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input type="file" accept="image/*" className="h-12" onChange={(e) => elegir(e.target.files?.[0] ?? null)} />
          {preview && (
            <div className="space-y-2 rounded border p-3 text-center">
              <img src={preview} alt="Vista previa de la señal" className="mx-auto max-h-60 rounded object-contain" />
              <p className="truncate text-xs text-muted-foreground">
                {file?.name} · {((file?.size ?? 0) / 1024).toFixed(0)} KB
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!file || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Usar esta imagen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Selector de imagen: catálogo del sistema + imágenes subidas. */
function ImagePicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [filtro, setFiltro] = useState("");
  const assets = useSenalAssets();
  const qc = useQueryClient();

  const borrarAsset = useMutation({
    mutationFn: async (a: { id: string; path: string; url: string }) => {
      const { error: sErr } = await supabase.storage.from("senales").remove([a.path]);
      if (sErr) throw sErr;
      const { error } = await supabase.from("senal_assets").delete().eq("id", a.id);
      if (error) throw error;
      if (value === a.url) onChange("");
    },
    onSuccess: () => { toast.success("Imagen eliminada del catálogo."); qc.invalidateQueries({ queryKey: ["senal-assets"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const subidas = useMemo(
    () => (assets.data ?? []).filter((a) => !filtro || a.nombre.toLowerCase().includes(filtro.toLowerCase())),
    [assets.data, filtro],
  );
  const opciones = useMemo(
    () => SENALES_IMGS.filter((s) => !filtro || s.toLowerCase().includes(filtro.toLowerCase())).slice(0, 48),
    [filtro],
  );

  return (
    <div className="space-y-2 rounded border p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <Label className="text-xs">{label}</Label>
          <p className="truncate text-xs text-muted-foreground">{value || "Sin seleccionar"}</p>
        </div>
        {value && <SenalImg src={value} className="h-16 w-16" />}
        <SubirSenal label={value ? "Reemplazar imagen" : "Subir imagen"} onListo={onChange} />
        {value && <Button size="sm" variant="ghost" onClick={() => onChange("")}>Quitar</Button>}
      </div>
      <Input placeholder="Filtrar por nombre (ej: A_1)" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
        {subidas.map((a) => (
          <div key={a.id} className="relative">
            <button type="button" onClick={() => onChange(a.url)}
              className={a.url === value ? "rounded ring-2 ring-primary" : "rounded opacity-80 hover:opacity-100"}>
              <SenalImg src={a.url} className="h-14 w-14" />
            </button>
            <ConfirmarBorrado
              titulo="¿Eliminar esta imagen del catálogo?"
              detalle="La imagen dejará de estar disponible para armar señales."
              onConfirm={() => borrarAsset.mutate(a)}
              trigger={
                <button type="button" aria-label="Eliminar imagen"
                  className="absolute -right-1 -top-1 rounded-full bg-destructive p-1 text-destructive-foreground">
                  <Trash2 className="h-3 w-3" />
                </button>
              }
            />
          </div>
        ))}
        {opciones.map((s) => (
          <button key={s} type="button" onClick={() => onChange(s)}
            className={s === value ? "rounded ring-2 ring-primary" : "rounded opacity-80 hover:opacity-100"}>
            <SenalImg src={s} className="h-14 w-14" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Copia una señal a otras clases (fusión de exámenes). */
function CopiarDialog({ senal, onSaved }: { senal: Senal; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [destinos, setDestinos] = useState<Clase[]>([]);

  const mut = useMutation({
    mutationFn: async () => {
      const filas = destinos.map((c) => ({
        clase: c,
        topic_id: senal.topic_id,
        pregunta: senal.pregunta,
        respuesta_correcta: senal.respuesta_correcta,
        opciones_incorrectas: senal.opciones_incorrectas ?? [],
        respuestas_aceptadas: [],
        activa: true,
        eliminatoria: senal.eliminatoria,
        peso: senal.peso,
        nivel: "medio",
        orden: 999,
        opciones_revisadas: (senal.opciones_incorrectas ?? []).filter(Boolean).length >= 3,
      }));
      const { error } = await supabase.from("questions").insert(filas as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Señal copiada."); setOpen(false); setDestinos([]); onSaved(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-10"><Copy className="mr-1 h-4 w-4" />Copiar a clase</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar señal a otras clases</DialogTitle>
          <DialogDescription>Se crea una copia independiente en cada clase seleccionada.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {CLASES.filter((c) => c !== senal.clase).map((c) => (
            <Button key={c} variant={destinos.includes(c) ? "default" : "outline"} className="h-11 min-w-14"
              onClick={() => setDestinos(destinos.includes(c) ? destinos.filter((x) => x !== c) : [...destinos, c])}>
              {c}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={destinos.length === 0 || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Copiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
