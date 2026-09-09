import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listExamsArchive, getExamDetail, firmarInspector, eliminarExamen, puedeBorrarExamenes } from "@/lib/archivo.functions";
import { ConfirmarBorrado } from "@/components/ConfirmarBorrado";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SignaturePad } from "@/components/SignaturePad";
import { MiFirmaGuardada, useMiFirma } from "@/components/MiFirmaGuardada";
import { esSenal, SenalImg } from "@/components/exam/ExamPieces";
import { exportExamExcel, exportExamPDF, exportListExcel } from "@/lib/export-utils";
import { toast } from "sonner";
import { Loader2, FileDown, FileText, Signature, Archive, CheckCircle2, XCircle, Printer, AlertTriangle, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/archivo")({ component: ArchivoPage });

function ArchivoPage() {
  const [tab, setTab] = useState<"aprobado"|"desaprobado"|"pendiente_firma"|"todos">("todos");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" />Archivo de exámenes</CardTitle>
          <CardDescription>Exámenes finalizados con detalle, firmas y exportación a PDF/Excel.</CardDescription>
        </CardHeader>
      </Card>
      <MiFirmaGuardada />
      <Tabs value={tab} onValueChange={(v)=>setTab(v as any)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="aprobado">Aprobados</TabsTrigger>
          <TabsTrigger value="desaprobado">Desaprobados</TabsTrigger>
          <TabsTrigger value="pendiente_firma">Pendientes firma inspector</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}><ArchiveList estado={tab} /></TabsContent>
      </Tabs>
    </div>
  );
}

function ArchiveList({ estado }: { estado: "aprobado"|"desaprobado"|"pendiente_firma"|"todos" }) {
  const fn = useServerFn(listExamsArchive);
  const q = useQuery({ queryKey: ["archive", estado], queryFn: () => fn({ data: { estado } }) });
  const permisoFn = useServerFn(puedeBorrarExamenes);
  const permiso = useQuery({ queryKey: ["puede-borrar-examenes"], queryFn: () => permisoFn() });
  const [openId, setOpenId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [fecha, setFecha] = useState("");

  if (q.isLoading) return <Loader2 className="h-6 w-6 animate-spin" />;
  const all = q.data ?? [];
  const term = busqueda.trim().toLowerCase();
  const rows = all.filter((e: any) => {
    const p = e.profiles ?? {};
    const texto = `${p.dni ?? ""} ${p.nombre ?? ""} ${p.apellido ?? ""}`.toLowerCase();
    const okTexto = !term || texto.includes(term);
    const okFecha = !fecha || (e.finished_at ?? "").slice(0, 10) === fecha;
    return okTexto && okFecha;
  });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Input className="h-11" placeholder="Buscar por DNI, nombre o apellido" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <Input className="h-11" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <Button variant="outline" className="h-11" disabled={rows.length === 0} onClick={()=>exportListExcel(rows, `examenes_${estado}.xlsx`)}>
          <FileDown className="mr-1 h-4 w-4" />Exportar lista
        </Button>
      </div>

      {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Sin exámenes archivados en esta categoría.</p>}
      {rows.map((e: any) => {
        const p = e.profiles ?? {};
        return (
          <Card key={e.id}>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{p.apellido}, {p.nombre} <span className="text-xs text-muted-foreground">· DNI {p.dni}</span></div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                    <Badge variant="outline">Clase {e.clase}</Badge>
                    {e.status === "aprobado" ? <Badge className="bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Aprobado</Badge>
                      : <Badge className="bg-destructive text-destructive-foreground"><XCircle className="h-3 w-3 mr-1" />Desaprobado</Badge>}
                    <span>{e.correctas ?? 0}/{e.total_preguntas ?? 0}</span>
                    <span>{e.finished_at ? new Date(e.finished_at).toLocaleString("es-AR") : ""}</span>
                    {e.signature_aspirante && <Badge variant="outline" className="text-xs">Firmado aspirante</Badge>}
                    {e.signature_inspector && <Badge variant="outline" className="text-xs">Firmado inspector</Badge>}
                    {e.segunda_oportunidad_usada && <Badge className="bg-warning text-warning-foreground text-xs"><AlertTriangle className="mr-1 h-3 w-3" />Usó 2ª oportunidad</Badge>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={()=>setOpenId(e.id)}><FileText className="mr-1 h-4 w-4" />Ver / firmar / exportar</Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {openId && <ExamDetailDialog examId={openId} onClose={()=>{ setOpenId(null); q.refetch(); }} />}
    </div>
  );
}

function ExamDetailDialog({ examId, onClose }: { examId: string; onClose: () => void }) {
  const fn = useServerFn(getExamDetail);
  const q = useQuery({ queryKey: ["exam-detail", examId], queryFn: () => fn({ data: { examId } }) });
  const firmarFn = useServerFn(firmarInspector);
  const qc = useQueryClient();
  const firmar = useMutation({
    mutationFn: async (firma: string) => await firmarFn({ data: { examId, firma } }),
    onSuccess: () => { toast.success("Firma del inspector guardada"); qc.invalidateQueries({ queryKey: ["exam-detail", examId] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del examen</DialogTitle>
          <DialogDescription>Todas las preguntas, respuestas y firmas.</DialogDescription>
        </DialogHeader>
        {q.isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : q.data && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => void exportExamPDF(q.data)}><FileDown className="mr-1 h-4 w-4" />Exportar PDF</Button>
              <Button size="sm" variant="outline" onClick={()=>exportExamExcel(q.data!)}><FileDown className="mr-1 h-4 w-4" />Exportar Excel</Button>
              <Button size="sm" variant="outline" onClick={() => void imprimirExamen(q.data)}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
            </div>
            <ExamPreview data={q.data} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-2">Firma del aspirante</p>
                {q.data.exam.signature_aspirante
                  ? <img src={q.data.exam.signature_aspirante} className="border rounded bg-white max-h-40" alt="Firma aspirante" />
                  : <p className="text-xs text-muted-foreground">Sin firma.</p>}
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Firma / aval del inspector</p>
                {q.data.exam.signature_inspector
                  ? <img src={q.data.exam.signature_inspector} className="border rounded bg-white max-h-40" alt="Firma inspector" />
                  : q.data.exam.signature_aspirante
                    ? <AvalInspector onFirmar={(url)=>firmar.mutate(url)} pendiente={firmar.isPending} />
                    : <p className="text-xs text-muted-foreground">El aspirante todavía no firmó.</p>}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Aval del inspector: usa la firma guardada con un toque, o permite dibujar otra. */
function AvalInspector({ onFirmar, pendiente }: { onFirmar: (url: string) => void; pendiente: boolean }) {
  const mi = useMiFirma();
  const [dibujar, setDibujar] = useState(false);
  if (mi.data?.firma && !dibujar) {
    return (
      <div className="space-y-2">
        <img src={mi.data.firma} alt="Mi firma guardada" className="max-h-32 w-full rounded border bg-white object-contain" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="h-11" disabled={pendiente} onClick={() => onFirmar(mi.data!.firma!)}>
            <Signature className="mr-1 h-4 w-4" />Avalar con mi firma
          </Button>
          <Button variant="outline" className="h-11" onClick={() => setDibujar(true)}>Firmar a mano</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <SignaturePad label="Firmá para avalar este examen" disabled={pendiente} onSave={onFirmar} />
      {mi.data?.firma && <Button variant="ghost" className="w-full" onClick={() => setDibujar(false)}>Usar mi firma guardada</Button>}
    </div>
  );
}

/** Celda de respuesta: si es una señal muestra la imagen, si no el texto. */
function Respuesta({ valor }: { valor?: string | null }) {
  if (!valor) return <span>—</span>;
  if (esSenal(valor)) return <SenalImg src={valor} className="h-20 w-20 border bg-white" />;
  return <span>{valor}</span>;
}

function ExamPreview({ data }: { data: any }) {
  const p = data.exam.profiles ?? {};
  const d = data.exam.datos_aspirante ?? {};
  return (
    <div className="text-sm space-y-2">
      <div className="rounded border p-3 bg-muted/30">
        <div><b>{d.apellido ?? p.apellido}, {d.nombre ?? p.nombre}</b> — DNI {d.dni ?? p.dni}</div>
        <div className="text-muted-foreground text-xs">{d.email ?? p.email} · {d.telefono ?? p.telefono}</div>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="bg-muted/40"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Pregunta</th><th className="p-2 text-left">Respondió</th><th className="p-2 text-left">Esperada</th><th className="p-2">OK</th></tr></thead>
          <tbody>
            {data.preguntas.map((r: any) => (
              <tr key={r.orden} className={`border-t align-top ${r.segunda_oportunidad ? "bg-warning/15" : ""}`}>
                <td className="p-2">{r.orden}</td>
                <td className="p-2">
                  {r.pregunta}{r.eliminatoria && <Badge className="ml-1 bg-destructive text-destructive-foreground text-[10px]">E</Badge>}
                  {r.segunda_oportunidad && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge className="bg-warning text-warning-foreground text-[10px]"><AlertTriangle className="mr-1 h-3 w-3" />2ª oportunidad</Badge>
                      <span className="text-[11px] text-muted-foreground">Primera respuesta (errónea):</span>
                      <Respuesta valor={r.respuesta_previa} />
                    </div>
                  )}
                </td>
                <td className="p-2"><Respuesta valor={r.respuesta_dada} /></td>
                <td className="p-2"><Respuesta valor={r.respuesta_correcta} /></td>
                <td className="p-2 text-center">{r.correcta ? "✓" : "✗"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Abre una ventana con el acta del examen lista para imprimir (con las imágenes de las señales). */
async function imprimirExamen(data: any) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) { toast.error("Permití las ventanas emergentes para imprimir."); return; }
  w.document.write('<!doctype html><html lang="es"><body style="font-family:system-ui;padding:24px">Preparando imágenes para imprimir…</body></html>');
  w.document.close();

  const p = data.exam.profiles ?? {};
  const d = data.exam.datos_aspirante ?? {};
  const rutas: string[] = Array.from(new Set<string>(
    (data.preguntas as any[]).flatMap((r: any) => [r.respuesta_dada, r.respuesta_correcta, r.respuesta_previa])
      .filter((v: unknown): v is string => typeof v === "string" && esSenal(v)),
  ));
  const imagenes = new Map<string, string>();
  await Promise.all(rutas.map(async (ruta) => {
    try {
      const response = await fetch(ruta, { cache: "force-cache" });
      if (!response.ok) return;
      const blob = await response.blob();
      const dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (dataUrl) imagenes.set(ruta, dataUrl);
    } catch {
      // Si una imagen puntual falla, el resto del acta continúa disponible.
    }
  }));
  const celda = (v?: string | null) =>
    !v ? "—" : esSenal(v)
      ? imagenes.has(v)
        ? `<img src="${imagenes.get(v)}" class="sig" alt="Señal de tránsito" />`
        : `<strong>Imagen no disponible</strong>`
      : escapeHtml(v);
  const filas = data.preguntas
    .map(
      (r: any) => `<tr${r.segunda_oportunidad ? ' class="so"' : ""}>
        <td>${r.orden}</td>
        <td>${escapeHtml(r.pregunta ?? "")}${r.eliminatoria ? " <b>(E)</b>" : ""}${r.segunda_oportunidad ? `<div class="so-nota"><b>⚠ 2ª OPORTUNIDAD</b> — primera respuesta (errónea): ${celda(r.respuesta_previa)}</div>` : ""}</td>
        <td>${celda(r.respuesta_dada)}</td>
        <td>${celda(r.respuesta_correcta)}</td>
        <td class="c">${r.correcta ? "✓" : "✗"}</td>
      </tr>`,
    )
    .join("");
  const firma = (src?: string | null, txt = "Sin firma") =>
    src ? `<img src="${src}" class="firma" />` : `<span class="muted">${txt}</span>`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<title>Acta de examen — ${escapeHtml(d.apellido ?? p.apellido ?? "")}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,Segoe UI,Arial,sans-serif;color:#111;margin:0;font-size:7.6px;line-height:1.15}
  h1{font-size:12px;margin:0 0 2px}
  table{width:100%;border-collapse:collapse;margin-top:4px;table-layout:fixed}
  th,td{border:1px solid #999;padding:1.5px 3px;vertical-align:top;text-align:left;word-wrap:break-word}
  th{background:#eee;font-size:7.6px}
  col.n{width:16px}col.r{width:19%}col.ok{width:16px}
  td.c{text-align:center;font-size:8px}
  tr{page-break-inside:avoid}
  img.sig{width:26px;height:26px;object-fit:contain;background:#fff;display:block}
  img.firma{max-height:52px;border:1px solid #999;background:#fff}
  .head{border:1px solid #999;padding:4px;background:#f5f5f5}
  .firmas{display:flex;gap:16px;margin-top:6px;page-break-inside:avoid}
  .firmas>div{flex:1}
  .firmas p{margin:0 0 2px}
  .muted{color:#666}
  tr.so td{background:#fff3cd}
  .so-nota{margin-top:2px;padding:1px 3px;border:1px solid #d39e00;background:#ffe8a1;font-size:7px}
  @page{size:A4;margin:8mm}
</style></head><body>
<h1>Acta de examen teórico — SIED</h1>
<div class="head">
  <div><b>${escapeHtml(`${d.apellido ?? p.apellido ?? ""}, ${d.nombre ?? p.nombre ?? ""}`)}</b> — DNI ${escapeHtml(d.dni ?? p.dni ?? "")}</div>
  <div>Clase ${escapeHtml(data.exam.clase ?? "")} · Resultado: <b>${(data.exam.status ?? "").toUpperCase()}</b> · ${data.exam.correctas ?? 0}/${data.exam.total_preguntas ?? 0}</div>
  <div>${data.exam.finished_at ? new Date(data.exam.finished_at).toLocaleString("es-AR") : ""}</div>
</div>
<table><colgroup><col class="n" /><col /><col class="r" /><col class="r" /><col class="ok" /></colgroup><thead><tr><th>#</th><th>Pregunta</th><th>Respondió</th><th>Esperada</th><th>OK</th></tr></thead><tbody>${filas}</tbody></table>
<div class="firmas">
  <div><p><b>Firma del aspirante</b></p>${firma(data.exam.signature_aspirante)}</div>
  <div><p><b>Firma / aval del inspector</b></p>${firma(data.exam.signature_inspector)}</div>
</div>
<script>
  const imagenes = Array.from(document.images);
  Promise.all(imagenes.map((img) => img.complete
    ? (img.decode ? img.decode().catch(() => undefined) : Promise.resolve())
    : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })
  )).then(() => setTimeout(() => window.print(), 250));
<\/script>
</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
