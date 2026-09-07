// Doble confirmación de borrado: primer aviso y segundo cartel de PELIGRO.
import { useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, ShieldAlert } from "lucide-react";

export function ConfirmarBorrado({
  trigger,
  titulo = "¿Eliminar este elemento?",
  detalle,
  onConfirm,
}: {
  trigger: ReactNode;
  titulo?: string;
  detalle?: string;
  onConfirm: () => void;
}) {
  const [paso, setPaso] = useState<0 | 1 | 2>(0);

  return (
    <>
      <span onClick={() => setPaso(1)} className="contents">{trigger}</span>

      <AlertDialog open={paso === 1} onOpenChange={(o) => !o && setPaso(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />{titulo}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {detalle ?? "Esta acción quita el elemento del sistema."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); setPaso(2); }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={paso === 2} onOpenChange={(o) => !o && setPaso(0)}>
        <AlertDialogContent className="border-2 border-destructive">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-destructive-foreground">
              <ShieldAlert className="h-5 w-5" />
              <span className="text-lg font-extrabold tracking-wide">PELIGRO</span>
            </div>
            <AlertDialogTitle className="pt-2">Confirmación final</AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
              El borrado es definitivo y no se puede deshacer. ¿Confirmás eliminarlo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">No, volver</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setPaso(0); onConfirm(); }}
            >
              Sí, eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
