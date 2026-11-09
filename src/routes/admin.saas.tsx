import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { usePlataforma } from "@/lib/use-plataforma";
import { FEATURES, PLANES, featuresDePlan, diasRestantesDemo, type PlanKey } from "@/lib/planes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmarBorrado } from "@/components/ConfirmarBorrado";
import { Building2, Crown, Sparkles, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { activarInstitucion, crearAdminInstitucion, cargarPlantillaBase } from "@/lib/instituciones.functions";
import logo from "@/assets/ia-triunfar-logo.jpg.asset.json";

export const Route = createFileRoute("/admin/saas")({
  head: () => ({ meta: [{ title: "Clientes y planes — SIED by IA Triunfar" }, { name: "description", content: "Gestión de instituciones, demos y planes mensuales." }] }),
  component: SaasPage,
});

type Inst = {
  id: string; nombre: string; localidad: string | null; contacto_email: string | null; contacto_nombre: string | null;
  plan: string; estado: string; es_principal: boolean; demo_vence: string | null; precio_mensual: number | null;
  features: Record<string, boolean>;
};

function SaasPage() {
  const { user } = useCurrentUser();
  const { isOwner, institucion: actual } = usePlataforma(user?.id);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["instituciones"],
    enabled: isOwner,
    queryFn: async () => {
      const { data, error } = await supabase.from("instituciones").select("*").order("es_principal", { ascending: false }).order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Inst[];
    },
  });
  const upd = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("instituciones").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["instituciones"] }); qc.invalidateQueries({ queryKey: ["institucion-principal"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("instituciones").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Institución eliminada."); qc.invalidateQueries({ queryKey: ["instituciones"] }); },
  });

  if (!isOwner) return <p className="text-muted-foreground">Sección exclusiva del proveedor de la plataforma.</p>;
  const lista = q.data ?? [];
  const activas = lista.filter((i) => i.estado === "activa").length;
  const demos = lista.filter((i) => i.estado === "demo").length;
  const mrr = lista.filter((i) => i.estado === "activa").reduce((a, i) => a + Number(i.precio_mensual ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
        <img src={logo.url} alt="IA Triunfar" className="h-14 w-auto rounded" />
        <div className="flex-1 min-w-[200px]">
          <h2 className="font-serif text-xl font-bold">Consola del proveedor</h2>
          <p className="text-sm text-muted-foreground">Instituciones clientes, demos y funciones según el plan mensual.</p>
        </div>
        <Stat label="Clientes activos" value={activas} />
        <Stat label="Demos" value={demos} />
        <Stat label="Ingreso mensual" value={`$ ${mrr.toLocaleString("es-AR")}`} />
      </div>

      <NuevaInstitucion />

      <div className="grid gap-4 lg:grid-cols-2">
        {lista.map((i) => {
          const dias = diasRestantesDemo(i.demo_vence);
          return (
            <Card key={i.id} className={i.es_principal ? "border-primary" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-5 w-5" />{i.nombre}</CardTitle>
                    <CardDescription>{i.localidad ?? "—"}{i.contacto_email ? ` · ${i.contacto_email}` : ""}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {i.es_principal && <Badge><Crown className="mr-1 h-3 w-3" />Esta instalación</Badge>}
                    <Badge variant={i.estado === "activa" ? "default" : i.estado === "demo" ? "secondary" : "destructive"}>
                      {i.estado === "demo" ? `Demo${dias !== null ? ` · ${dias > 0 ? `${dias} días` : "vencida"}` : ""}` : i.estado === "activa" ? "Activa" : "Suspendida"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Plan</Label>
                    <Select value={i.plan} onValueChange={(v) => upd.mutate({ id: i.id, patch: { plan: v, features: featuresDePlan(v as PlanKey) } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(PLANES).map(([k, p]) => <SelectItem key={k} value={k}>{p.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Estado</Label>
                    <Select value={i.estado} onValueChange={(v) => upd.mutate({ id: i.id, patch: { estado: v } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="demo">Demo</SelectItem>
                        <SelectItem value="activa">Activa</SelectItem>
                        <SelectItem value="suspendida">Suspendida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Abono mensual ($)</Label>
                    <Input type="number" defaultValue={i.precio_mensual ?? ""} onBlur={(e) => upd.mutate({ id: i.id, patch: { precio_mensual: e.target.value ? Number(e.target.value) : null } })} />
                  </div>
                  <div>
                    <Label className="text-xs">Extender demo</Label>
                    <div className="flex gap-1">
                      {[7, 14, 30].map((d) => (
                        <Button key={d} size="sm" variant="outline" onClick={() => upd.mutate({ id: i.id, patch: { estado: "demo", demo_vence: new Date(Date.now() + d * 86400000).toISOString() } })}>+{d}d</Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="divide-y rounded-lg border">
                  {FEATURES.map((f) => (
                    <label key={f.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span><span className="block text-sm font-medium">{f.nombre}</span><span className="block text-xs text-muted-foreground">{f.detalle}</span></span>
                      <Switch checked={i.features?.[f.key] === true} onCheckedChange={(v) => upd.mutate({ id: i.id, patch: { features: { ...i.features, [f.key]: v } } })} />
                    </label>
                  ))}
                </div>
                <HerramientasMunicipio inst={i} activa={(actual as any)?.id === i.id} />
                {!i.es_principal && (
                  <ConfirmarBorrado titulo={`¿Eliminar ${i.nombre}?`} detalle="Se borra la cuenta de la institución del listado de clientes." onConfirm={() => del.mutate(i.id)} trigger={<Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="mr-1 h-4 w-4" />Eliminar cliente</Button>} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-muted px-4 py-2 text-center"><div className="text-xl font-bold">{value}</div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div></div>;
}

function NuevaInstitucion() {
  const qc = useQueryClient();
  const [f, setF] = useState({ nombre: "", localidad: "", contacto_nombre: "", contacto_email: "", plan: "profesional" as PlanKey, dias: "14" });
  const crear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("instituciones").insert({
        nombre: f.nombre.trim(), localidad: f.localidad || null, contacto_nombre: f.contacto_nombre || null, contacto_email: f.contacto_email || null,
        plan: f.plan, estado: "demo", features: featuresDePlan(f.plan), demo_vence: new Date(Date.now() + Number(f.dias) * 86400000).toISOString(),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Demo creada."); setF({ ...f, nombre: "", localidad: "", contacto_nombre: "", contacto_email: "" }); qc.invalidateQueries({ queryKey: ["instituciones"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-accent" />Nueva institución / demo</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <Input placeholder="Nombre (ej. Municipalidad de Colón)" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        <Input placeholder="Localidad" value={f.localidad} onChange={(e) => setF({ ...f, localidad: e.target.value })} />
        <Input placeholder="Contacto" value={f.contacto_nombre} onChange={(e) => setF({ ...f, contacto_nombre: e.target.value })} />
        <Input type="email" placeholder="Correo de contacto" value={f.contacto_email} onChange={(e) => setF({ ...f, contacto_email: e.target.value })} />
        <Select value={f.plan} onValueChange={(v) => setF({ ...f, plan: v as PlanKey })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(PLANES).map(([k, p]) => <SelectItem key={k} value={k}>Plan {p.nombre}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex gap-2">
          <Select value={f.dias} onValueChange={(v) => setF({ ...f, dias: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["7", "14", "30"].map((d) => <SelectItem key={d} value={d}>Demo {d} días</SelectItem>)}</SelectContent>
          </Select>
          <Button disabled={f.nombre.trim().length < 3 || crear.isPending} onClick={() => crear.mutate()}>Crear</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HerramientasMunicipio({ inst, activa }: { inst: Inst; activa: boolean }) {
  const qc = useQueryClient();
  const activarFn = useServerFn(activarInstitucion);
  const adminFn = useServerFn(crearAdminInstitucion);
  const plantillaFn = useServerFn(cargarPlantillaBase);
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ nombre: "", apellido: "", email: "", password: "" });
  const activar = useMutation({
    mutationFn: () => activarFn({ data: { institucionId: inst.id } }),
    onSuccess: () => { toast.success(`Ahora trabajás en ${inst.nombre}.`); qc.invalidateQueries(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const crear = useMutation({
    mutationFn: () => adminFn({ data: { institucionId: inst.id, ...f } }),
    onSuccess: () => { toast.success("Administrador creado. Ya puede ingresar con su correo y contraseña."); setF({ nombre: "", apellido: "", email: "", password: "" }); setAbierto(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  const plantilla = useMutation({
    mutationFn: () => plantillaFn({ data: { institucionId: inst.id } }),
    onSuccess: (r) => toast.success(`Cargadas ${r.preguntas} preguntas y ${r.categorias} categorías base.`),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos propios del municipio</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={activa ? "default" : "outline"} disabled={activa || activar.isPending} onClick={() => activar.mutate()}>
          {activa ? "Trabajando aquí" : "Entrar a este municipio"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAbierto((v) => !v)}>Crear administrador</Button>
        {!inst.es_principal && (
          <Button size="sm" variant="outline" disabled={plantilla.isPending} onClick={() => plantilla.mutate()}>
            {plantilla.isPending ? "Cargando…" : "Cargar plantilla base"}
          </Button>
        )}
      </div>
      {abierto && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          <Input placeholder="Apellido" value={f.apellido} onChange={(e) => setF({ ...f, apellido: e.target.value })} />
          <Input type="email" placeholder="Correo" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Input type="password" placeholder="Contraseña (mín. 8)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <Button className="sm:col-span-2" disabled={crear.isPending || !f.nombre || !f.apellido || !f.email || f.password.length < 8} onClick={() => crear.mutate()}>
            Crear administrador de {inst.nombre}
          </Button>
        </div>
      )}
    </div>
  );
}
