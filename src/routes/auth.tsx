import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapFirstAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Ingresar — SIED" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/panel" });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-institutional px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-institutional-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" /> SIED
          </div>
          <h1 className="mt-4 font-serif text-2xl font-bold">Ingresar al sistema</h1>
          <p className="text-sm text-muted-foreground">Dirección de Tránsito y Transporte</p>
        </div>
        <Card>
          <Tabs defaultValue="aspirante">
            <CardHeader className="pb-3">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="aspirante">Aspirante</TabsTrigger>
                <TabsTrigger value="staff">Personal</TabsTrigger>
              </TabsList>
            </CardHeader>
            <TabsContent value="aspirante"><AspiranteForm /></TabsContent>
            <TabsContent value="staff"><StaffForm /></TabsContent>
          </Tabs>
        </Card>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:underline">Volver al inicio</Link>
          {" · "}
          <Link to="/bootstrap" className="hover:underline">Primera vez (crear administrador)</Link>
        </div>
      </div>
    </div>
  );
}

function AspiranteForm() {
  const navigate = useNavigate();
  const [dni, setDni] = useState("");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const email = `${dni.trim()}@aspirante.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password: codigo.trim() });
    setLoading(false);
    if (error) { toast.error("DNI o código incorrecto"); return; }
    toast.success("Bienvenido");
    navigate({ to: "/aspirante" });
  };
  return (
    <CardContent>
      <CardDescription className="mb-4">Ingresá tu DNI y el código que te dio el inspector.</CardDescription>
      <form onSubmit={handle} className="space-y-4">
        <div>
          <Label htmlFor="dni">DNI</Label>
          <Input id="dni" required inputMode="numeric" pattern="[0-9]*" placeholder="Ej: 32456789" value={dni} onChange={(e) => setDni(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="codigo">Código de examen</Label>
          <Input id="codigo" required placeholder="6 dígitos" value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={12} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ingresar
        </Button>
      </form>
    </CardContent>
  );
}

function StaffForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { toast.error("Credenciales incorrectas"); return; }
    toast.success("Bienvenido");
    navigate({ to: "/panel" });
  };

  const recuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Ingresá tu correo."); return; }
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setEnviando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Te enviamos un correo para restablecer la contraseña.");
    setRecuperando(false);
  };

  if (recuperando) {
    return (
      <CardContent>
        <CardDescription className="mb-4">
          Ingresá tu correo y te enviamos un enlace para crear una contraseña nueva.
        </CardDescription>
        <form onSubmit={recuperar} className="space-y-4">
          <div>
            <Label htmlFor="re">Correo</Label>
            <Input id="re" type="email" required className="h-12" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="h-12 w-full" disabled={enviando}>
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar enlace
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setRecuperando(false)}>
            Volver
          </Button>
        </form>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <CardDescription className="mb-4">Acceso para administradores e inspectores.</CardDescription>
      <form onSubmit={handle} className="space-y-4">
        <div>
          <Label htmlFor="e">Correo</Label>
          <Input id="e" type="email" required className="h-12" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="p">Contraseña</Label>
          <Input id="p" type="password" required className="h-12" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="h-12 w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ingresar
        </Button>
        <button
          type="button"
          onClick={() => setRecuperando(true)}
          className="w-full text-center text-sm text-muted-foreground hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </form>
    </CardContent>
  );
}
