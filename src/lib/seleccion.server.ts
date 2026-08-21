// Selección de preguntas para un examen combinado por categoría.
// Server-only: se importa desde los handlers de las server functions.
import { shuffle, buildOptions } from "@/lib/mc";

export type Categoria = {
  slug: string;
  nombre: string;
  tipo: string;
  grupo: string;
  clases: string[];
  incluye_senales: boolean;
  preguntas_senales: number;
  cantidad_preguntas: number;
  duracion_minutos: number;
  max_errores: number;
};

export const CATEGORIA_FALLBACK = (clase: string): Categoria => ({
  slug: `clase-${clase}`,
  nombre: `Clase ${clase}`,
  tipo: "principiante",
  grupo: "particular",
  clases: clase === "UNICA" ? ["UNICA"] : ["UNICA", clase],
  incluye_senales: true,
  preguntas_senales: 5,
  cantidad_preguntas: 20,
  duracion_minutos: 15,
  max_errores: 4,
});

/** Devuelve la categoría del examen, o una equivalente derivada de la clase. */
export async function resolverCategoria(admin: any, slug: string | null | undefined, clase: string): Promise<Categoria> {
  if (slug) {
    const { data } = await admin.from("exam_categories").select("*").eq("slug", slug).maybeSingle();
    if (data) return data as Categoria;
  }
  return CATEGORIA_FALLBACK(clase);
}

type Pregunta = {
  id: string;
  pregunta: string;
  eliminatoria: boolean;
  peso: number;
  respuesta_correcta: string;
  opciones_incorrectas: string[] | null;
  topic_id: string | null;
};

/**
 * Arma el listado final de preguntas del examen: primero cubre el cupo de
 * señales de tránsito y después completa con el resto de las clases incluidas.
 */
export async function seleccionarPreguntas(admin: any, cat: Categoria) {
  const clases = cat.clases.length > 0 ? cat.clases : ["UNICA"];
  const { data: pool } = await admin
    .from("questions")
    .select("id, pregunta, eliminatoria, peso, respuesta_correcta, opciones_incorrectas, topic_id")
    .in("clase", clases)
    .eq("activa", true);
  const preguntas = (pool ?? []) as Pregunta[];
  if (preguntas.length === 0) throw new Error("No hay preguntas disponibles para esta categoría.");

  // Señales: SOLO de las clases incluidas en la categoría (nunca de otras clases).
  let senalesIds = new Set<string>();
  let senales: Pregunta[] = [];
  if (cat.incluye_senales && cat.preguntas_senales > 0) {
    const { data: topic } = await admin.from("topics").select("id").eq("slug", "senales").maybeSingle();
    if (topic?.id) {
      senales = shuffle(preguntas.filter((q) => q.topic_id === topic.id)).slice(0, cat.preguntas_senales);
      senalesIds = new Set(senales.map((q) => q.id));
    }
  }

  const resto = shuffle(preguntas.filter((q) => !senalesIds.has(q.id)));
  const faltan = Math.max(0, cat.cantidad_preguntas - senales.length);
  const seleccion = shuffle([...senales, ...resto.slice(0, faltan)]);


  return seleccion.map((q, i) => ({
    question_id: q.id,
    orden: i + 1,
    snapshot: {
      pregunta: q.pregunta,
      eliminatoria: q.eliminatoria,
      peso: q.peso,
      opciones: buildOptions(q.respuesta_correcta, q.opciones_incorrectas ?? []),
    },
  }));
}
