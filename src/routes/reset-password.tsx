import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Restablecer contraseña | SIED Tránsito" },
      { name: "description", content: "Definí una nueva contraseña para tu cuenta de personal del sistema de exámenes de licencias." },
      { property: "og:title", content: "Restablecer contraseña | SIED Tránsito" },
      { property: "og:description", content: "Definí una nueva contraseña para tu cuenta de personal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [listo, setListo] = useState(false);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // El enlace del correo deja una sesión de recuperación activa.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setListo(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setListo(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres."); return; }
    if (pass !== pass2) { toast.error("Las contraseñas no coinciden."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contraseña actualizada. Ingresá con la nueva.");
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-institutional text-institutional-foreground">
            <KeyRound className="h-5 w-5" />
          </div>
          <CardTitle>Nueva contraseña</CardTitle>
          <CardDescription>
            {listo
              ? "Definí una contraseña nueva para tu cuenta de personal."
              : "Abrí esta página desde el enlace que te llegó por correo para poder cambiar la contraseña."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={guardar} className="space-y-4">
            <div>
              <Label htmlFor="np">Contraseña nueva</Label>
              <Input id="np" type="password" required className="h-12" value={pass} onChange={(e) => setPass(e.target.value)} disabled={!listo} />
            </div>
            <div>
              <Label htmlFor="np2">Repetir contraseña</Label>
              <Input id="np2" type="password" required className="h-12" value={pass2} onChange={(e) => setPass2(e.target.value)} disabled={!listo} />
            </div>
            <Button type="submit" className="h-12 w-full" disabled={!listo || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar contraseña
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="hover:underline">Volver al ingreso</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
