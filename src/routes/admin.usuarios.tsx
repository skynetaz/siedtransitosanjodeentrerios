import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createStaff } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";

export const Route = createFileRoute("/admin/usuarios")({ component: Usuarios });

function Usuarios() {
  const list = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data: roles, error } = await supabase.from("user_roles").select("user_id, role").in("role", ["admin", "inspector"]);
      if (error) throw error;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
      return (roles ?? []).map((r) => ({ ...r, profile: profs?.find((p) => p.id === r.user_id) }));
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Personal (Administradores e Inspectores)</h2>
        <CreateStaffDialog />
      </div>
      <div className="grid gap-2">
        {(list.data ?? []).map((r: any) => (
          <Card key={r.user_id + r.role}>
            <CardContent className="pt-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{r.profile?.nombre} {r.profile?.apellido}</div>
                <div className="text-sm text-muted-foreground">{r.profile?.email}</div>
              </div>
              <Badge variant={r.role === "admin" ? "default" : "secondary"}>{r.role}</Badge>
            </CardContent>
          </Card>
        ))}
        {(list.data ?? []).length === 0 && <div className="text-center text-muted-foreground py-6">Aún no hay personal registrado.</div>}
      </div>
    </div>
  );
}

function CreateStaffDialog() {
  const qc = useQueryClient();
  const fn = useServerFn(createStaff);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: "", password: "", nombre: "", apellido: "", role: "inspector" as "admin"|"inspector" });
  const mut = useMutation({
    mutationFn: async () => { await fn({ data: f }); },
    onSuccess: () => { toast.success("Usuario creado"); qc.invalidateQueries({ queryKey: ["staff-list"] }); setOpen(false); setF({ email:"", password:"", nombre:"", apellido:"", role:"inspector" }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><UserPlus className="mr-1 h-4 w-4" />Nuevo usuario</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear administrador o inspector</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nombre</Label><Input value={f.nombre} onChange={(e)=>setF({...f,nombre:e.target.value})} /></div>
            <div><Label>Apellido</Label><Input value={f.apellido} onChange={(e)=>setF({...f,apellido:e.target.value})} /></div>
          </div>
          <div><Label>Correo</Label><Input type="email" value={f.email} onChange={(e)=>setF({...f,email:e.target.value})} /></div>
          <div><Label>Contraseña (mín 8)</Label><Input type="password" value={f.password} onChange={(e)=>setF({...f,password:e.target.value})} /></div>
          <div><Label>Rol</Label>
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inspector">Inspector</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
