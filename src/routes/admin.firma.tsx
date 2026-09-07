// Sección dedicada para grabar o editar la firma del inspector/administrador.
import { createFileRoute } from "@tanstack/react-router";
import { MiFirmaGuardada } from "@/components/MiFirmaGuardada";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/firma")({
  component: FirmaPage,
  head: () => ({
    meta: [
      { title: "Mi firma | SIED Tránsito" },
      { name: "description", content: "Grabá o editá tu firma de inspector para avalar los exámenes con un solo toque." },
      { property: "og:title", content: "Mi firma | SIED Tránsito" },
      { property: "og:description", content: "Grabá o editá tu firma de inspector para avalar los exámenes con un solo toque." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function FirmaPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Firma del inspector</CardTitle>
          <CardDescription>
            Grabá tu firma una sola vez y quedará guardada en tu cuenta. Al avalar un examen se aplica
            con un toque, y podés modificarla o eliminarla cuando quieras.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Consejo: firmá con lápiz táctil o con el dedo dentro del recuadro, mirá el ejemplo y confirmala.
        </CardContent>
      </Card>
      <MiFirmaGuardada />
    </div>
  );
}
