// Componente reutilizable de firma digital. Devuelve un data URL PNG.
// Optimizado para celulares: el lienzo ocupa todo el ancho disponible, se
// adapta a la densidad de pantalla y acepta dedo, mouse y lápiz táctil
// (eventos Pointer con presión).
import SignatureCanvas from "react-signature-canvas";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Check, PenLine } from "lucide-react";

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
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [empty, setEmpty] = useState(!initialDataUrl);

  // El lienzo se dimensiona al contenedor real (ancho completo en celular).
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const medir = () => {
      const w = Math.max(240, Math.round(el.clientWidth));
      const alto = Math.round(Math.min(Math.max(window.innerHeight * 0.32, 180), 340));
      setSize((prev) => (prev && prev.w === w && prev.h === alto ? prev : { w, h: alto }));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    window.addEventListener("orientationchange", medir);
    return () => { ro.disconnect(); window.removeEventListener("orientationchange", medir); };
  }, [initialDataUrl]);

  // Ajuste de densidad de pantalla para trazo nítido y sin desfasaje del puntero.
  useEffect(() => {
    if (!size) return;
    const canvas = ref.current?.getCanvas();
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = size.w * ratio;
    canvas.height = size.h * ratio;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    canvas.getContext("2d")?.scale(ratio, ratio);
    ref.current?.clear();
    setEmpty(true);
  }, [size]);

  if (initialDataUrl) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <img src={initialDataUrl} alt="Firma" className="max-h-40 w-full rounded border bg-white object-contain" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <PenLine className="h-3.5 w-3.5 shrink-0" />
        <span>{label} — podés usar el dedo o un lápiz táctil.</span>
      </div>
      <div ref={boxRef} className="w-full touch-none overscroll-none rounded-lg border-2 border-dashed bg-white">
        {size && (
          <SignatureCanvas
            ref={(r) => { ref.current = r; }}
            penColor="#0f172a"
            minWidth={0.8}
            maxWidth={2.8}
            velocityFilterWeight={0.6}
            throttle={8}
            canvasProps={{
              width: size.w,
              height: size.h,
              className: "block w-full touch-none cursor-crosshair rounded-lg",
              style: { touchAction: "none" },
            }}
            onEnd={() => setEmpty(ref.current?.isEmpty() ?? true)}
          />
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" size="lg" variant="outline" className="h-12 sm:h-11"
          disabled={disabled} onClick={() => { ref.current?.clear(); setEmpty(true); }}>
          <Eraser className="mr-1 h-4 w-4" />Borrar
        </Button>
        <Button type="button" size="lg" className="h-12 sm:h-11" disabled={disabled || empty} onClick={() => {
          const url = ref.current?.getCanvas().toDataURL("image/png");
          if (url) onSave(url);
        }}>
          <Check className="mr-1 h-4 w-4" />Confirmar firma
        </Button>
      </div>
    </div>
  );
}
