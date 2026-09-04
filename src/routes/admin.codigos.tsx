import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generarCodigo, listarCodigos, cancelarCodigo, eliminarCodigo } from "@/lib/codigos.functions";
import { listarCategorias } from "@/lib/categorias.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Loader2, Plus, Search, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/codigos")({ component: CodigosPage });

type Estado = "todos" | "disponible" | "utilizado" | "cancelado" | "expirado";

function CodigosPage() {
  const qc = useQueryClient();
  const [estado, setEstado] = useState<Estado>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [ultimo, setUltimo] = useState<{ codigo: string; expires_at: string } | null>(null);

  const listar = useServerFn(listarCodigos);
  const cancelar = useServerFn(cancelarCodigo);
  const eliminar = useServerFn(eliminarCodigo);

  const q = useQuery({
    queryKey: ["codigos", estado, busqueda],
    queryFn: () => listar({ data: { estado, busqueda: busqueda || undefined } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["codigos"] });
  const cancelMut = useMutation({
    mutationFn: async (id: string) => await cancelar({ data: { id } }),
    onSuccess: () => { toast.success("Código cancelado."); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const delMut = useMutation({
    mutationFn: async (id: string) => await eliminar({ data: { id } }),
    onSuccess: () => { toast.success("Código eliminado."); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-xl font-bold">Códigos de examen</h2>
          <p className="text-sm text-muted-foreground">Únicos, de un solo uso y con vigencia de 15 minutos.</p>
        </div>
        <Button className="h-11 shrink-0" onClick={() => setAbierto((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" />Generar código
        </Button>
      </div>

      {ultimo && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Código generado</p>
              <p className="font-mono text-3xl font-black tracking-[0.25em]">{ultimo.codigo}</p>
              <p className="text-xs text-muted-foreground">Vence {new Date(ultimo.expires_at).toLocaleTimeString("es-AR")}</p>
            </div>
            <Button variant="outline" className="h-11" onClick={() => { navigator.clipboard.writeText(ultimo.codigo); toast.success("Copiado"); }}>
              <Copy className="mr-1 h-4 w-4" />Copiar
            </Button>
          </CardContent>
        </Card>
      )}

      {abierto && <FormularioCodigo onDone={(c) => { setUltimo(c); setAbierto(false); invalidate(); }} />}

      <Tabs value={estado} onValueChange={(v) => setEstado(v as Estado)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="disponible">Disponibles</TabsTrigger>
          <TabsTrigger value="utilizado">Utilizados</TabsTrigger>
          <TabsTrigger value="cancelado">Cancelados</TabsTrigger>
          <TabsTrigger value="expirado">Expirados</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-12 pl-9" placeholder="Buscar por DNI o código" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {q.isLoading ? (
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      ) : (q.data ?? []).length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No hay códigos para mostrar.</p>
      ) : (
        <div className="space-y-3">
          {(q.data ?? []).map((c: any) => (
            <Card key={c.id}>
              <CardContent className="space-y-2 py-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-2xl font-bold tracking-[0.2em]">{c.codigo}</p>
                    <p className="truncate text-sm font-medium">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">DNI {c.dni ?? "—"} · {c.categoria_slug ?? `Clase ${c.clase}`}</p>
                  </div>
                  <EstadoBadge status={c.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Generado {new Date(c.created_at).toLocaleString("es-AR")}
                  {c.used_at ? ` · Utilizado ${new Date(c.used_at).toLocaleString("es-AR")}` : c.expires_at ? ` · Vence ${new Date(c.expires_at).toLocaleTimeString("es-AR")}` : ""}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {c.status === "disponible" && (
                    <Button variant="outline" size="sm" className="h-10" onClick={() => cancelMut.mutate(c.id)}>
                      <Ban className="mr-1 h-4 w-4" />Cancelar
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-10 text-destructive" onClick={() => delMut.mutate(c.id)}>
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

function EstadoBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    disponible: "bg-success text-success-foreground",
    utilizado: "bg-muted text-muted-foreground",
    cancelado: "bg-destructive text-destructive-foreground",
    expirado: "bg-warning text-warning-foreground",
  };
  return <Badge className={`${map[status] ?? ""} shrink-0 capitalize`}>{status}</Badge>;
}

function FormularioCodigo({ onDone }: { onDone: (c: { codigo: string; expires_at: string }) => void }) {
  const [form, setForm] = useState({ dni: "", nombre: "", apellido: "", email: "", telefono: "", categoria: "" });
  const generar = useServerFn(generarCodigo);
  const catsFn = useServerFn(listarCategorias);
  const cats = useQuery({ queryKey: ["categorias"], queryFn: () => catsFn() });
  const activas = ((cats.data ?? []) as any[]).filter((c) => c.activa);
  const catElegida = activas.find((c) => c.slug === form.categoria);


  const grupos = [
    { key: "particular", label: "Particulares" },
    { key: "profesional", label: "Profesionales" },
  ];

  const mut = useMutation({
    mutationFn: async () => await generar({ data: form }),
    onSuccess: (r: any) => { toast.success("Código generado."); onDone({ codigo: r.codigo, expires_at: r.expires_at }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const puede = form.dni.trim().length >= 6 && form.nombre.trim() && form.apellido.trim() && form.categoria;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Nuevo código</CardTitle>
        <CardDescription>Se asocia al DNI y habilita un único examen combinado según la categoría.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={`space-y-2 rounded-lg border-2 p-3 ${
            form.categoria ? "border-success/60 bg-success/5" : "border-destructive bg-destructive/5"
          }`}
        >
          <Label className="flex items-center gap-2 text-base font-extrabold uppercase tracking-wide">
            <AlertTriangle className={`h-5 w-5 ${form.categoria ? "text-success" : "text-destructive"}`} />
            Categoría del examen
          </Label>
          <p className={`text-sm font-semibold ${form.categoria ? "text-success" : "text-destructive"}`}>
            {form.categoria
              ? `Vas a habilitar: ${catElegida?.nombre ?? form.categoria}`
              : "Seleccione una categoría de examen para poder generar el código."}
          </p>
          <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
            <SelectTrigger className="h-14 text-base font-bold">
              <SelectValue placeholder="Seleccione una categoría de examen" />
            </SelectTrigger>
            <SelectContent>
              {grupos.map((g) => (
                <SelectGroup key={g.key}>
                  <SelectLabel>{g.label}</SelectLabel>
                  {activas.filter((c) => c.grupo === g.key).map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>{c.nombre}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="DNI"><Input className="h-12" inputMode="numeric" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Nombre"><Input className="h-12" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
          <Field label="Apellido"><Input className="h-12" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} /></Field>
          <Field label="Correo (opcional)"><Input className="h-12" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Teléfono (opcional)"><Input className="h-12" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Field>
        </div>
        <Button className="h-12 w-full" disabled={!puede || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Generar código
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
