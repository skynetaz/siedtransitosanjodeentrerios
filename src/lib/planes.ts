export type FeatureKey = "encuestas" | "estadisticas" | "emulador" | "importador" | "ia" | "senales_hd" | "actas_personalizadas";
export type PlanKey = "basico" | "profesional" | "enterprise";

export const FEATURES: { key: FeatureKey; nombre: string; detalle: string }[] = [
  { key: "senales_hd", nombre: "Señales en alta definición", detalle: "Catálogo oficial ANSV nítido" },
  { key: "estadisticas", nombre: "Estadísticas y tiempos", detalle: "Panel de rendimiento y tiempo ideal" },
  { key: "encuestas", nombre: "Encuestas de satisfacción", detalle: "Opiniones de los aspirantes" },
  { key: "emulador", nombre: "Emulador de examen", detalle: "Práctica para el personal" },
  { key: "importador", nombre: "Importador masivo", detalle: "Preguntas desde PDF / Excel / JSON" },
  { key: "ia", nombre: "Asistente con IA", detalle: "Genera opciones automáticamente" },
  { key: "actas_personalizadas", nombre: "Actas personalizadas", detalle: "Membrete y escudo propio" },
];

export const PLANES: Record<PlanKey, { nombre: string; precio: number; features: FeatureKey[] }> = {
  basico: { nombre: "Básico", precio: 0, features: ["senales_hd"] },
  profesional: { nombre: "Profesional", precio: 0, features: ["senales_hd", "estadisticas", "encuestas"] },
  enterprise: { nombre: "Enterprise", precio: 0, features: FEATURES.map((f) => f.key) },
};

export function featuresDePlan(plan: PlanKey): Record<FeatureKey, boolean> {
  const on = new Set(PLANES[plan].features);
  return Object.fromEntries(FEATURES.map((f) => [f.key, on.has(f.key)])) as Record<FeatureKey, boolean>;
}

/** Una función sin dato explícito queda habilitada (no se le quita nada al cliente actual). */
export function featureActiva(features: Record<string, boolean> | null | undefined, key: FeatureKey): boolean {
  if (!features || !(key in features)) return true;
  return features[key] === true;
}

export function diasRestantesDemo(vence: string | null, ahora = new Date()): number | null {
  if (!vence) return null;
  return Math.ceil((new Date(vence).getTime() - ahora.getTime()) / 86400000);
}

/** Ruta del panel → función de plan que la habilita. */
export const TAB_FEATURE: Record<string, FeatureKey> = {
  "/admin/emulador": "emulador",
  "/admin/importar": "importador",
  "/admin/estadisticas": "estadisticas",
  "/admin/opiniones": "encuestas",
};
