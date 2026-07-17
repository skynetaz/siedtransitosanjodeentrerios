import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { importarPreguntas } from "@/lib/importer.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Upload, FileJson } from "lucide-react";

export const Route = createFileRoute("/admin/importar")({ component: ImportarPage });

const ejemplo = JSON.stringify([
  {
    clase: "B",
    tema: "Prioridades",
    pregunta: "¿Quién tiene prioridad de paso en una bocacalle sin señalización?",
    respuesta_correcta: "El que viene por la derecha",
    respuestas_aceptadas: ["derecha", "el de la derecha"],
    eliminatoria: true,
    activa: true,
    peso: 1,
    nivel: "facil",
  },
  {
    clase: "A",
    tema: "Casco",
    pregunta: "¿El uso del casco es obligatorio para conductor y acompañante?",
    respuesta_correcta: "Sí",
    respuestas_aceptadas: ["si", "es obligatorio"],
    eliminatoria: true,
    nivel: "facil",
  },
], null, 2);

function ImportarPage() {
  const [json, setJson] = useState("");
  const [reemplazar, setReemplazar] = useState(false);
  const fn = useServerFn(importarPreguntas);
  const mut = useMutation({
    mutationFn: async (items: any[]) => await fn({ data: { items, reemplazarPorClase: reemplazar } }),
    onSuccess: (r) => toast.success(`${r.insertadas} preguntas importadas`),
    onError: (e) => toast.error((e as Error).message),
  });

  const handleImport = () => {
    let items: any[];
    try {
      items = JSON.parse(json);
      if (!Array.isArray(items)) throw new Error("El JSON debe ser un array.");
    } catch (e) {
      toast.error("JSON inválido: " + (e as Error).message);
      return;
    }
    mut.mutate(items);
  };

  const handleFile = async (f: File) => {
    const text = await f.text();
    setJson(text);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileJson className="h-5 w-5" />Importar banco de preguntas (JSON)</CardTitle>
          <CardDescription>Formato: array de objetos con clase, tema, pregunta, respuesta_correcta, respuestas_aceptadas, eliminatoria, activa, peso, nivel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Archivo .json</Label>
            <Input type="file" accept="application/json,.json" onChange={(e)=>{ const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
          <div>
            <Label>o pegar el JSON</Label>
            <Textarea rows={14} className="font-mono text-xs" value={json} onChange={(e)=>setJson(e.target.value)} placeholder={ejemplo} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={reemplazar} onCheckedChange={(v)=>setReemplazar(!!v)} />
            Desactivar las preguntas actuales de las clases que aparecen en este archivo (recomendado para reemplazar)
          </label>
          <div className="flex gap-2">
            <Button onClick={handleImport} disabled={!json.trim() || mut.isPending}>
              {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Upload className="mr-2 h-4 w-4" />Importar
            </Button>
            <Button variant="outline" onClick={()=>setJson(ejemplo)}>Cargar ejemplo</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm " + (props.className ?? "")} />;
}
