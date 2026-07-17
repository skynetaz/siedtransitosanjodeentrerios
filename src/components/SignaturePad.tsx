// Componente reutilizable de firma digital. Devuelve un data URL PNG.
import SignatureCanvas from "react-signature-canvas";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Check } from "lucide-react";

export function SignaturePad({
  onSave,
  label = "Firmá dentro del recuadro",
  disabled = false,
  initialDataUrl,
}: {
  onSave: (dataUrl: string) => void;
  label?: string;
  disabled?: boolean;
  initialDataUrl?: string | null;
}) {
  const ref = useRef<SignatureCanvas | null>(null);
  const [empty, setEmpty] = useState(!initialDataUrl);

  if (initialDataUrl) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <img src={initialDataUrl} alt="Firma" className="border rounded bg-white max-h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="rounded border bg-white touch-none">
        <SignatureCanvas
          ref={(r) => { ref.current = r; }}
          penColor="#0f172a"
          canvasProps={{ width: 520, height: 160, className: "w-full h-40" }}
          onEnd={() => setEmpty(ref.current?.isEmpty() ?? true)}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => { ref.current?.clear(); setEmpty(true); }}>
          <Eraser className="h-4 w-4 mr-1" />Borrar
        </Button>
        <Button type="button" size="sm" disabled={disabled || empty} onClick={() => {
          const url = ref.current?.getCanvas().toDataURL("image/png");
          if (url) onSave(url);
        }}>
          <Check className="h-4 w-4 mr-1" />Confirmar firma
        </Button>
      </div>
    </div>
  );
}
