// Etiqueta legible de la categoría de examen realmente rendida.
// Los exámenes guardan `categoria_slug`, `clases_incluidas` y un
// `config_snapshot` con el nombre de la categoría al momento de rendir.
// La letra `clase` es solo un resumen histórico y NO debe usarse como
// título cuando existe la categoría real.

export type ExamLike = {
  clase?: string | null;
  categoria_nombre?: string | null;
  categoria_slug?: string | null;
  clases_incluidas?: string[] | null;
  config_snapshot?: any;
};

/** Nombre de la categoría (ej. "Anexo / Caduco — Moto y Auto (A+B)"). */
export function nombreCategoria(exam: ExamLike | null | undefined): string {
  if (!exam) return "—";
  const nombre = exam.categoria_nombre || exam.config_snapshot?.nombre;
  if (nombre) return nombre;
  const slug = exam.categoria_slug || exam.config_snapshot?.categoria;
  if (slug) return slug;
  return exam.clase ? `Clase ${exam.clase}` : "—";
}

/** Clases incluidas, sin la clase técnica "UNICA" (ej. "A + B"). */
export function clasesDeExamen(exam: ExamLike | null | undefined): string {
  const cl = (exam?.clases_incluidas ?? []).filter((c) => c && c !== "UNICA");
  if (cl.length > 0) return cl.join(" + ");
  return exam?.clase && exam.clase !== "UNICA" ? exam.clase : "";
}

/** Etiqueta completa: categoría + clases incluidas. */
export function etiquetaExamen(exam: ExamLike | null | undefined): string {
  const nombre = nombreCategoria(exam);
  const clases = clasesDeExamen(exam);
  return clases ? `${nombre} · clases ${clases}` : nombre;
}
