import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listExamsArchive, getExamDetail, firmarInspector } from "@/lib/archivo.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SignaturePad } from "@/components/SignaturePad";
import { exportExamExcel, exportExamPDF, exportListExcel } from "@/lib/export-utils";
import { toast } from "sonner";
import { Loader2, FileDown, FileText, Signature, Archive, CheckCircle2, XCircle } from "lucide-react";

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
              <Button size="sm" onClick={()=>exportExamPDF(q.data!)}><FileDown className="mr-1 h-4 w-4" />Exportar PDF</Button>
              <Button size="sm" variant="outline" onClick={()=>exportExamExcel(q.data!)}><FileDown className="mr-1 h-4 w-4" />Exportar Excel</Button>
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
                    ? <SignaturePad label="Firmá para avalar este examen" onSave={(url)=>firmar.mutate(url)} />
                    : <p className="text-xs text-muted-foreground">El aspirante todavía no firmó.</p>}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
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
      <div className="rounded border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Pregunta</th><th className="p-2 text-left">Respondió</th><th className="p-2 text-left">Esperada</th><th className="p-2">OK</th></tr></thead>
          <tbody>
            {data.preguntas.map((r: any) => (
              <tr key={r.orden} className="border-t align-top">
                <td className="p-2">{r.orden}</td>
                <td className="p-2">{r.pregunta}{r.eliminatoria && <Badge className="ml-1 bg-destructive text-destructive-foreground text-[10px]">E</Badge>}</td>
                <td className="p-2">{r.respuesta_dada || "—"}</td>
                <td className="p-2">{r.respuesta_correcta}</td>
                <td className="p-2 text-center">{r.correcta ? "✓" : "✗"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
