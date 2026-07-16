// Normalización de respuestas de examen: sin acentos, sin puntuación,
// espacios colapsados, minúsculas. Se usa para comparar la respuesta del
// aspirante con la respuesta correcta y las respuestas aceptadas.
export function normalizeAnswer(input: string): string {
  return (input ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita diacríticos
    .toLowerCase()
    .replace(/[.,;:!¡¿?"“”'`´()\-–—/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function answersMatch(
  given: string | null | undefined,
  correct: string,
  accepted: string[] = [],
): boolean {
  if (!given) return false;
  const g = normalizeAnswer(given);
  if (!g) return false;
  const candidates = [correct, ...accepted].map(normalizeAnswer).filter(Boolean);
  return candidates.some((c) => c === g || (c.length > 4 && (g.includes(c) || c.includes(g))));
}
