import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { escanearDocumento, type PreguntaEscaneada } from "@/lib/escaneo.functions";
import { importarPreguntas } from "@/lib/importer.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ScanLine, Trash2, CheckCircle2 } from "lucide-react";

const CLASES = ["A", "B", "C", "D", "E", "UNICA"] as const;
type Fila = PreguntaEscaneada & { incluir: boolean };

function aBase64(buf: ArrayBuffer) {
  let bin = ""; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function EscanerExamen() {
  const escanear = useServerFn(escanearDocumento);
  const importar = useServerFn(importarPreguntas);
  const [clase, setClase] = useState<string>("AUTO");
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);

  const leer = useMutation({
    mutationFn: async () => {
      const claseSugerida = clase as any;
      if (archivo) {
        if (archivo.size > 10 * 1024 * 1024) throw new Error("El archivo supera 10 MB.");
        const n = archivo.name.toLowerCase();
        if (n.endsWith(".docx")) {
          const mammoth = await import("mammoth");
          const r = await mammoth.extractRawText({ arrayBuffer: await archivo.arrayBuffer() });
          return escanear({ data: { texto: r.value, claseSugerida } });
        }
        if (n.endsWith(".txt") || n.endsWith(".csv") || n.endsWith(".md")) {
          return escanear({ data: { texto: await archivo.text(), claseSugerida } });
        }
        const mime = archivo.type || (n.endsWith(".pdf") ? "application/pdf" : "");
        if (!mime.startsWith("image/") && mime !== "application/pdf") throw new Error("Formato no soportado. Usá PDF, Word (.docx), foto o texto.");
        return escanear({ data: { archivoBase64: aBase64(await archivo.arrayBuffer()), mime, nombre: archivo.name, claseSugerida } });
      }
      return escanear({ data: { texto, claseSugerida } });
    },
    onSuccess: (r) => {
      setFilas(r.items.map((it) => ({ ...it, incluir: true })));
      toast[r.items.length ? "success" : "warning"](r.items.length ? `Se detectaron ${r.items.length} preguntas. Revisalas antes de guardar.` : "No se detectaron preguntas.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const guardar = useMutation({
    mutationFn: async () => {
      const items = filas.filter((f) => f.incluir).map(({ incluir, ...f }) => ({ ...f, activa: true }));
      if (!items.length) throw new Error("No hay preguntas marcadas.");
      return importar({ data: { items, reemplazarPorClase: false } });
    },
    onSuccess: (r) => { toast.success(`${r.insertadas} preguntas incorporadas al banco de tu institución.`); setFilas([]); setArchivo(null); setTexto(""); },
    onError: (e) => toast.error((e as Error).message),
  });

  const set = (i: number, patch: Partial<Fila>) => setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const marcadas = filas.filter((f) => f.incluir).length;

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" />Escáner inteligente de exámenes</CardTitle>
        <CardDescription>Subí un examen en PDF, Word, foto del celular o pegá el texto. La IA detecta preguntas, opciones y la respuesta correcta. Nada se guarda hasta que lo confirmes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div>
            <Label>Archivo (PDF, .docx, JPG, PNG, texto)</Label>
            <Input type="file" accept=".pdf,.docx,.txt,.csv,.md,image/*" capture={undefined} onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label>Clase</Label>
            <Select value={clase} onValueChange={setClase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Detectar automáticamente</SelectItem>
                {CLASES.map((c) => <SelectItem key={c} value={c}>{c === "UNICA" ? "Única / general" : `Clase ${c}`}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {!archivo && (
          <div>
            <Label>o pegá el texto del examen</Label>
            <Textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="1. ¿Qué indica una luz amarilla intermitente? a) ... b) ... c) ..." />
          </div>
        )}
        <Button size="lg" onClick={() => leer.mutate()} disabled={leer.isPending || (!archivo && texto.trim().length < 10)}>
          {leer.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
          {leer.isPending ? "Leyendo documento…" : "Escanear y detectar preguntas"}
        </Button>

        {filas.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{marcadas} de {filas.length} preguntas marcadas</p>
              <Button onClick={() => guardar.mutate()} disabled={guardar.isPending || marcadas === 0}>
                {guardar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Confirmar e incorporar al banco
              </Button>
            </div>
            {filas.map((f, i) => (
              <div key={i} className={`space-y-2 rounded-lg border p-3 ${f.incluir ? "" : "opacity-50"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Checkbox checked={f.incluir} onCheckedChange={(v) => set(i, { incluir: !!v })} />
                  <Badge variant="outline">#{i + 1}</Badge>
                  <Select value={f.clase} onValueChange={(v) => set(i, { clase: v as any })}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{CLASES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input className="h-8 w-40" value={f.tema} onChange={(e) => set(i, { tema: e.target.value })} />
                  <label className="flex items-center gap-1 text-xs"><Checkbox checked={f.eliminatoria} onCheckedChange={(v) => set(i, { eliminatoria: !!v })} />Eliminatoria</label>
                  <Button size="icon" variant="ghost" className="ml-auto h-8 w-8 text-destructive" onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <Textarea rows={2} value={f.pregunta} onChange={(e) => set(i, { pregunta: e.target.value })} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><Label className="text-xs text-primary">Respuesta correcta</Label><Input className="border-primary" value={f.respuesta_correcta} onChange={(e) => set(i, { respuesta_correcta: e.target.value })} /></div>
                  {[0, 1, 2].map((k) => (
                    <div key={k}><Label className="text-xs">Opción incorrecta {k + 1}</Label>
                      <Input value={f.opciones_incorrectas[k] ?? ""} onChange={(e) => { const o = [...f.opciones_incorrectas]; o[k] = e.target.value; set(i, { opciones_incorrectas: o.filter((x, idx) => x || idx < k) }); }} /></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
