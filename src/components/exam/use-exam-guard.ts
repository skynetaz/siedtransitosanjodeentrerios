import { useEffect, useRef } from "react";

type GuardOpts = {
  active: boolean;
  /** Primera infracción: advertencia. Segunda: cancelación. */
  onWarning: (motivo: string) => void;
  onCancel: (motivo: string) => void;
};

/**
 * Vigila pantalla completa, cambio de pestaña/app, pérdida de foco y recarga
 * durante el examen. Además bloquea copiar/pegar/cortar/selección/menú.
 */
export function useExamGuard({ active, onWarning, onCancel }: GuardOpts) {
  const strikes = useRef(0);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!active) return;

    const strike = (motivo: string) => {
      if (cancelled.current) return;
      strikes.current += 1;
      if (strikes.current === 1) onWarning(motivo);
      else {
        cancelled.current = true;
        onCancel(motivo);
      }
    };

    const onVisibility = () => { if (document.hidden) strike("Cambio de pestaña o aplicación"); };
    const onBlur = () => strike("Pérdida de foco de la pantalla");
    const onFsChange = () => { if (!document.fullscreenElement) strike("Salida de pantalla completa"); };
    const block = (e: Event) => { e.preventDefault(); return false; };
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("selectstart", block);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("selectstart", block);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active, onWarning, onCancel]);
}

/** Pide pantalla completa; en iOS puede no estar disponible y se ignora. */
export async function requestFullscreen() {
  try {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (document.fullscreenElement) return;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch {
    /* no soportado */
  }
}

export async function exitFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* ignorar */
  }
}
