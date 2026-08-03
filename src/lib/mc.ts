// Utilidades puras para el formato de opción múltiple.
export function shuffle<T>(arr: T[]): T[] {
  return arr
    .map((v) => ({ v, s: Math.random() }))
    .sort((a, b) => a.s - b.s)
    .map((x) => x.v);
}

/**
 * Arma las 4 opciones de una pregunta: la correcta + hasta 3 incorrectas,
 * mezcladas. Si faltan distractores devuelve las que haya.
 */
export function buildOptions(correcta: string, incorrectas: string[] = []): string[] {
  const limpias = incorrectas
    .map((o) => (o ?? "").trim())
    .filter((o) => o.length > 0 && o.toLowerCase() !== correcta.trim().toLowerCase());
  const unicas = Array.from(new Set(limpias)).slice(0, 3);
  return shuffle([correcta.trim(), ...unicas]);
}
