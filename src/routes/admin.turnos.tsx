import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listarTurnos, guardarConfigTurnos, probarHoja, disponibilidadHoja, accionTurno, asignarPendientesFn } from "@/lib/turnos.functions";
import { armarMensajeTurno, contactoValido } from "@/lib/turnos-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/turnos")({
  head: () => ({ meta: [
    { title: "Turnos prácticos | SIED Tránsito" },
    { name: "description", content: "Asignación automática de turnos del examen práctico conectada con la hoja de Google." },
    { property: "og:title", content: "Turnos prácticos | SIED Tránsito" },
    { property: "og:description", content: "Horarios libres, turnos asignados y pendientes del examen práctico." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: TurnosPage,
});

const MOTIVO: Record<string, string> = { sin_cupo: "Sin lugares libres", error_hoja: "Error al conectar con la hoja", sin_clase: "Falta elegir la clase" };

function TurnosPage() {
  const qc = useQueryClient();
  const listar = useServerFn(listarTurnos); const accion = useServerFn(accionTurno);
  const pend = useServerFn(asignarPendientesFn); const disp = useServerFn(disponibilidadHoja);
  const q = useQuery({ queryKey: ["turnos"], queryFn: () => listar() });
  const [busca, setBusca] = useState(""); const [libres, setLibres] = useState<any[] | null>(null); const [cargando, setCargando] = useState(false);
  const turnos = q.data?.turnos ?? [];
  const asignados = useMemo(() => turnos.filter((t: any) => t.estado !== "pendiente").filter((t: any) => !busca || `${t.persona?.apellido} ${t.persona?.dni}`.toLowerCase().includes(busca.toLowerCase())), [turnos, busca]);
  const pendientes = turnos.filter((t: any) => t.estado === "pendiente");
  const refrescar = () => qc.invalidateQueries({ queryKey: ["turnos"] });
  const hacer = async (id: string, a: any, clase?: any) => { try { await accion({ data: { id, accion: a, clase } }); toast.success("Listo"); refrescar(); } catch (e) { toast.error((e as Error).message); } };

  if (q.isLoading) return <Loader2 className="h-6 w-6 animate-spin" />;
  const cfg = q.data?.config;
  return (
    <Tabs defaultValue="asignados" className="space-y-3">
      <TabsList className="flex h-auto flex-wrap">
        <TabsTrigger value="libres">Horarios libres</TabsTrigger>
        <TabsTrigger value="asignados">Turnos asignados</TabsTrigger>
        <TabsTrigger value="pendientes">Pendientes {pendientes.length > 0 && <Badge variant="destructive" className="ml-1">{pendientes.length}</Badge>}</TabsTrigger>
        <TabsTrigger value="config">Configuración</TabsTrigger>
      </TabsList>

      <TabsContent value="libres"><Card><CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap gap-2">
          <Button disabled={cargando} onClick={async () => { setCargando(true); const r: any = await disp(); setCargando(false); if (!r.ok) toast.error(r.error); else setLibres(r.hojas ?? []); }}>{cargando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Actualizar</Button>
          {cfg?.sheet_url && <Button variant="outline" asChild><a href={cfg.sheet_url} target="_blank" rel="noreferrer">Abrir hoja de Google</a></Button>}
        </div>
        <p className="text-sm text-muted-foreground">Para habilitar un día nuevo, duplicá una pestaña en la hoja, renombrala con el formato CLASE B,C,D 26-11-26 y borrá los nombres.</p>
        {libres && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th>Fecha</th><th>Clases</th><th>Lugares</th><th>Libres</th></tr></thead><tbody>
          {libres.map((h) => <tr key={h.hoja} className="border-t"><td>{h.fecha}</td><td>{h.clases?.join(", ")}</td><td>{h.total}</td><td className={h.libres <= 2 ? "font-bold text-destructive" : ""}>{h.libres}</td></tr>)}
        </tbody></table></div>}
      </CardContent></Card></TabsContent>

      <TabsContent value="asignados"><Card><CardContent className="space-y-3 pt-6">
        <Input placeholder="Buscar por DNI o apellido" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {asignados.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay turnos asignados.</p>}
        {asignados.map((t: any) => {
          const c = contactoValido(t.persona?.email, t.persona?.telefono);
          const msg = t.fecha && cfg ? armarMensajeTurno({ nombre: t.persona?.nombre ?? "", apellido: t.persona?.apellido ?? "", categoria: t.categoria_slug ?? `clase ${t.clase}`, fecha: t.fecha, hora: t.hora ?? "", lugar: cfg.lugar, reglas: cfg.mensaje_reglas }) : "";
          return <div key={t.id} className="rounded-lg border p-3 text-sm space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{t.persona?.apellido} {t.persona?.nombre} · DNI {t.persona?.dni}</strong><Badge>{t.estado}</Badge></div>
            <div>{t.fecha ?? "—"} {t.hora?.slice(0, 5)} hs · Clase {t.clase}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!c.telefono} title={c.telefono ? "" : "Sin teléfono válido"} asChild={!!c.telefono}>{c.telefono ? <a href={`https://wa.me/${c.telefono}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">Enviar por WhatsApp</a> : <span>Sin WhatsApp</span>}</Button>
              <Button size="sm" variant="outline" onClick={() => hacer(t.id, "presente")}>Presente</Button>
              <Button size="sm" variant="outline" onClick={() => hacer(t.id, "ausente")}>Ausente</Button>
              <Button size="sm" variant="outline" onClick={() => hacer(t.id, "reasignar")}>Reasignar</Button>
              <Button size="sm" variant="destructive" onClick={() => confirm("¿Cancelar este turno y liberar el lugar en la hoja?") && hacer(t.id, "cancelar")}>Cancelar</Button>
            </div>
          </div>;
        })}
      </CardContent></Card></TabsContent>

      <TabsContent value="pendientes"><Card><CardContent className="space-y-3 pt-6">
        <Button onClick={async () => { const r = await pend(); toast.success(`Procesados: ${r.procesados}`); refrescar(); }}>Asignar ahora</Button>
        {pendientes.map((t: any) => <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span><strong>{t.persona?.apellido} {t.persona?.nombre}</strong> · {MOTIVO[t.motivo] ?? t.motivo}</span>
          {t.motivo === "sin_clase" && <div className="flex gap-1">{["A", "B", "C", "D", "E"].map((c) => <Button key={c} size="sm" variant="outline" onClick={() => hacer(t.id, "clase", c)}>{c}</Button>)}</div>}
        </div>)}
        {pendientes.length === 0 && <p className="text-sm text-muted-foreground">No hay pendientes.</p>}
      </CardContent></Card></TabsContent>

      <TabsContent value="config"><ConfigForm cfg={cfg} onSaved={refrescar} /></TabsContent>
    </Tabs>
  );
}

function ConfigForm({ cfg, onSaved }: { cfg: any; onSaved: () => void }) {
  const guardar = useServerFn(guardarConfigTurnos); const ping = useServerFn(probarHoja);
  const [f, setF] = useState({ lugar: "", mensaje_reglas: "", dias_minimos_antes: 1, enviar_email: true, sheet_url: "", aviso_sin_cupo: "" });
  useEffect(() => { if (cfg) setF({ lugar: cfg.lugar ?? "", mensaje_reglas: cfg.mensaje_reglas ?? "", dias_minimos_antes: cfg.dias_minimos_antes ?? 1, enviar_email: cfg.enviar_email ?? true, sheet_url: cfg.sheet_url ?? "", aviso_sin_cupo: cfg.aviso_sin_cupo ?? "" }); }, [cfg]);
  return <Card><CardHeader><CardTitle>Configuración de turnos</CardTitle></CardHeader><CardContent className="space-y-3">
    <label className="block text-sm">Lugar<Input value={f.lugar} onChange={(e) => setF({ ...f, lugar: e.target.value })} /></label>
    <label className="block text-sm">Reglas del mensaje<Textarea rows={8} value={f.mensaje_reglas} onChange={(e) => setF({ ...f, mensaje_reglas: e.target.value })} /></label>
    <label className="block text-sm">Días mínimos entre la aprobación y el turno<Input type="number" min={0} value={f.dias_minimos_antes} onChange={(e) => setF({ ...f, dias_minimos_antes: Number(e.target.value) })} /></label>
    <label className="block text-sm">Aviso cuando no hay lugar<Input value={f.aviso_sin_cupo} onChange={(e) => setF({ ...f, aviso_sin_cupo: e.target.value })} /></label>
    <label className="block text-sm">Dirección (link) de la hoja de Google<Input value={f.sheet_url} onChange={(e) => setF({ ...f, sheet_url: e.target.value })} /></label>
    <div className="flex flex-wrap gap-2">
      <Button onClick={async () => { await guardar({ data: { ...f, sheet_url: f.sheet_url || null, aviso_sin_cupo: f.aviso_sin_cupo || null } }); toast.success("Guardado"); onSaved(); }}>Guardar</Button>
      <Button variant="outline" onClick={async () => { const r: any = await ping(); r.ok ? toast.success("La hoja respondió correctamente ✔") : toast.error(r.error ?? "Sin respuesta"); }}>Probar conexión con la hoja</Button>
    </div>
  </CardContent></Card>;
}
