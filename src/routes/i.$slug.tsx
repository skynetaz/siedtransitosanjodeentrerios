import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PoweredBy } from "@/components/brand/PoweredBy";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/i/$slug")({
  head: () => ({ meta: [
    { title: "Ingreso institucional — SIED" },
    { name: "description", content: "Acceso al sistema de evaluación para licencias de conducir de su municipio." },
    { property: "og:title", content: "Ingreso institucional — SIED" },
    { property: "og:description", content: "Acceso al sistema de evaluación para licencias de conducir de su municipio." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Pagina,
});

function Pagina() {
  const { slug } = Route.useParams();
  const q = useQuery({ queryKey: ["inst-publica", slug], queryFn: async () => {
    const { data } = await supabase.rpc("institucion_publica", { _slug: slug });
    return (data as any[])?.[0] ?? null;
  } });
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        {q.isLoading ? <CardContent className="p-10"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></CardContent> : !q.data ? (
          <CardHeader><CardTitle>Institución no encontrada</CardTitle><CardDescription>Verificá el enlace recibido.</CardDescription></CardHeader>
        ) : (<>
          <CardHeader>
            {q.data.logo_url && <img src={q.data.logo_url} alt="" className="mx-auto h-20 w-auto" />}
            <CardTitle className="text-2xl">{q.data.nombre}</CardTitle>
            <CardDescription>{q.data.localidad ?? ""}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild size="lg" className="w-full"><Link to="/examen">Soy aspirante: rendir examen</Link></Button>
            <Button asChild size="lg" variant="outline" className="w-full"><Link to="/auth">Ingreso del personal</Link></Button>
            <PoweredBy className="pt-2" />
          </CardContent>
        </>)}
      </Card>
    </div>
  );
}
