import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapFirstAdmin } from "@/lib/admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/bootstrap")({
  head: () => ({ meta: [{ title: "Configuración inicial — SIED" }] }),
  component: BootstrapPage,
});

function BootstrapPage() {
  const navigate = useNavigate();
  const fn = useServerFn(bootstrapFirstAdmin);
  const [form, setForm] = useState({ email: "", password: "", nombre: "", apellido: "" });
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fn({ data: form });
      toast.success("Administrador creado. Ya podés iniciar sesión.");
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-accent" /><CardTitle>Crear primer administrador</CardTitle></div>
          <CardDescription>Solo funciona si aún no existe ningún administrador registrado.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre</Label><Input required value={form.nombre} onChange={(e)=>setForm({...form,nombre:e.target.value})} /></div>
              <div><Label>Apellido</Label><Input required value={form.apellido} onChange={(e)=>setForm({...form,apellido:e.target.value})} /></div>
            </div>
            <div><Label>Correo</Label><Input type="email" required value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} /></div>
            <div><Label>Contraseña (mín 8)</Label><Input type="password" required minLength={8} value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Crear administrador</Button>
            <div className="text-center text-sm"><Link to="/auth" className="hover:underline">Ya tengo cuenta</Link></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
