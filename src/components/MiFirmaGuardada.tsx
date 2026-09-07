// Firma guardada del personal: se registra una vez y se aplica con un toque.
// Incluye edición y borrado.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMiFirma, guardarMiFirma, borrarMiFirma } from "@/lib/firma.functions";
import { SignaturePad } from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, PenLine, Pencil, Trash2 } from "lucide-react";

/** Hook compartido: devuelve la firma guardada del usuario actual. */
export function useMiFirma() {
  const fn = useServerFn(getMiFirma);
  return useQuery({ queryKey: ["mi-firma"], queryFn: () => fn({}) });
}

export function MiFirmaGuardada() {
  const q = useMiFirma();
  const qc = useQueryClient();
  const guardarFn = useServerFn(guardarMiFirma);
  const borrarFn = useServerFn(borrarMiFirma);
  const [editando, setEditando] = useState(false);

  const guardar = useMutation({
    mutationFn: async (firma: string) => await guardarFn({ data: { firma } }),
    onSuccess: () => {
      toast.success("Firma guardada. Se usará por defecto al avalar exámenes.");
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["mi-firma"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const borrar = useMutation({
    mutationFn: async () => await borrarFn({}),
    onSuccess: () => { toast.success("Firma eliminada."); qc.invalidateQueries({ queryKey: ["mi-firma"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><PenLine className="h-4 w-4" />Mi firma</CardTitle>
        <CardDescription>
          Guardá tu firma una sola vez: al avalar un examen se aplica con un toque, sin volver a dibujarla.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : q.data?.firma && !editando ? (
          <div className="space-y-3">
            <img src={q.data.firma} alt="Mi firma guardada" className="max-h-40 w-full rounded border bg-white object-contain" />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="h-11" onClick={() => setEditando(true)}>
                <Pencil className="mr-1 h-4 w-4" />Modificar firma
              </Button>
              <Button variant="ghost" className="h-11 text-destructive" disabled={borrar.isPending} onClick={() => borrar.mutate()}>
                <Trash2 className="mr-1 h-4 w-4" />Eliminar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <SignaturePad
              label={editando ? "Dibujá tu nueva firma" : "Dibujá tu firma para guardarla"}
              disabled={guardar.isPending}
              onSave={(url) => guardar.mutate(url)}
            />
            {editando && (
              <Button variant="ghost" className="w-full" onClick={() => setEditando(false)}>Cancelar</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
