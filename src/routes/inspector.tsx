import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCurrentRole } from "@/lib/use-current-user";
import { AppShell } from "@/components/AppShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { registerAspirante, habilitarExamen, cancelarExamen } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, Search, UserPlus, KeyRound, XCircle, Copy, History } from "lucide-react";

export const Route = createFileRoute("/inspector")({ component: InspectorPanel });

function InspectorPanel() {
  const { loading, user, isInspector, isAdmin } = useCurrentRole();
  const [q, setQ] = useState("");
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isInspector && !isAdmin) return <Navigate to="/panel" replace />;

  return (
    <AppShell title="Panel Inspector" subtitle="Buscar aspirantes, habilitar exámenes y ver historial">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>Buscar aspirante</CardTitle>
                <RegisterAspiranteDialog />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="DNI, apellido o correo" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
          <ResultsList query={q} />
        </div>
        <RecentExams />
      </div>
    </AppShell>
  );
}

function ResultsList({ query }: { query: string }) {
  const list = useQuery({
    queryKey: ["aspirantes", query],
    queryFn: async () => {
      let base = supabase.from("profiles").select("*").not("dni", "is", null).order("apellido").limit(30);
      if (query.trim()) {
        const term = query.trim();
        base = base.or(`dni.ilike.%${term}%,apellido.ilike.%${term}%,email.ilike.%${term}%,nombre.ilike.%${term}%`);
      }
      const { data, error } = await base;
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-2">
      {(list.data ?? []).map((p: any) => <AspiranteRow key={p.id} p={p} />)}
      {(list.data ?? []).length === 0 && <div className="text-center text-muted-foreground py-6 text-sm">No hay aspirantes que coincidan.</div>}
    </div>
  );
}

function AspiranteRow({ p }: { p: any }) {
  const exam = useQuery({
    queryKey: ["last-exam", p.id],
    queryFn: async () => {
      const { data } = await supabase.from("exams").select("*").eq("aspirante_id", p.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });
  const qc = useQueryClient();
  const habilFn = useServerFn(habilitarExamen);
  const cancelFn = useServerFn(cancelarExamen);
  const [codeShown, setCodeShown] = useState<string | null>(null);

  const habil = useMutation({
    mutationFn: async () => await habilFn({ data: { aspiranteId: p.id } }),
    onSuccess: (r) => { setCodeShown(r.code); qc.invalidateQueries({ queryKey: ["last-exam", p.id] }); toast.success("Examen habilitado"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const cancel = useMutation({
    mutationFn: async (examId: string) => await cancelFn({ data: { examId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["last-exam", p.id] }); toast.success("Examen cancelado"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const status = exam.data?.status;
  const statusColor: Record<string, string> = {
    habilitado: "bg-warning text-warning-foreground",
    rindiendo: "bg-primary text-primary-foreground",
    aprobado: "bg-success text-success-foreground",
    desaprobado: "bg-destructive text-destructive-foreground",
    cancelado: "bg-muted text-muted-foreground",
    finalizado: "bg-muted text-muted-foreground",
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-semibold">{p.apellido}, {p.nombre}</div>
              <Badge variant="outline">Clase {p.license_class}</Badge>
              {status && <Badge className={statusColor[status] ?? ""}>{status}</Badge>}
            </div>
            <div className="text-sm text-muted-foreground">DNI {p.dni}{p.telefono ? ` · ${p.telefono}` : ""}</div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {(status === "habilitado" || status === "rindiendo") && exam.data?.id ? (
              <Button variant="outline" size="sm" onClick={() => cancel.mutate(exam.data!.id)}><XCircle className="mr-1 h-4 w-4" />Cancelar</Button>
            ) : (
              <Button size="sm" onClick={() => habil.mutate()} disabled={habil.isPending}><KeyRound className="mr-1 h-4 w-4" />Habilitar examen</Button>
            )}
            {(status === "desaprobado" || status === "aprobado" || status === "cancelado") && (
              <Button size="sm" variant="secondary" onClick={() => habil.mutate()} disabled={habil.isPending}>Nuevo intento</Button>
            )}
          </div>
        </div>
        {codeShown && (
          <div className="mt-3 rounded-md border-2 border-accent bg-accent/10 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Código de examen para {p.dni}</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="font-mono text-3xl font-bold tracking-widest">{codeShown}</div>
              <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(codeShown); toast.success("Copiado"); }}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Válido por 4 horas. Dictáselo al aspirante.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RegisterAspiranteDialog() {
  const qc = useQueryClient();
  const fn = useServerFn(registerAspirante);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ dni: "", nombre: "", apellido: "", telefono: "", license_class: "B" as const });
  const mut = useMutation({
    mutationFn: async () => await fn({ data: f as any }),
    onSuccess: () => { toast.success("Aspirante registrado"); qc.invalidateQueries({ queryKey: ["aspirantes"] }); setOpen(false); setF({ dni:"", nombre:"", apellido:"", telefono:"", license_class:"B" }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><UserPlus className="mr-1 h-4 w-4" />Registrar aspirante</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar nuevo aspirante</DialogTitle><DialogDescription>Después podrás habilitarle un examen.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>DNI</Label><Input value={f.dni} onChange={(e)=>setF({...f,dni:e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nombre</Label><Input value={f.nombre} onChange={(e)=>setF({...f,nombre:e.target.value})} /></div>
            <div><Label>Apellido</Label><Input value={f.apellido} onChange={(e)=>setF({...f,apellido:e.target.value})} /></div>
          </div>
          <div><Label>Teléfono (opcional)</Label><Input value={f.telefono} onChange={(e)=>setF({...f,telefono:e.target.value})} /></div>
          <div><Label>Clase de licencia</Label>
            <Select value={f.license_class} onValueChange={(v) => setF({ ...f, license_class: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["UNICA","A","B","C","D","E"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button onClick={()=>mut.mutate()} disabled={mut.isPending}>Registrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecentExams() {
  const q = useQuery({
    queryKey: ["recent-exams"],
    queryFn: async () => {
      const { data } = await supabase.from("exams").select("*, profiles!exams_aspirante_id_fkey(dni,nombre,apellido)").order("created_at", { ascending: false }).limit(15);
      return data ?? [];
    },
  });
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><History className="h-4 w-4" />Últimos exámenes</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {(q.data ?? []).map((e: any) => (
          <div key={e.id} className="text-sm border-b last:border-0 pb-2 last:pb-0">
            <div className="font-medium">{e.profiles?.apellido}, {e.profiles?.nombre}</div>
            <div className="text-xs text-muted-foreground flex justify-between"><span>Clase {e.clase} · {e.status}</span><span>{new Date(e.created_at).toLocaleDateString("es-AR")}</span></div>
          </div>
        ))}
        {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin actividad reciente.</p>}
      </CardContent>
    </Card>
  );
}
