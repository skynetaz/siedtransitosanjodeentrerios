export type FeatureKey = "encuestas" | "estadisticas" | "emulador" | "importador" | "ia" | "senales_hd" | "actas_personalizadas" | "turnos";
export type PlanKey = "basico" | "profesional" | "enterprise";

export const FEATURES: { key: FeatureKey; nombre: string; detalle: string }[] = [
  { key: "senales_hd", nombre: "Señales en alta definición", detalle: "Catálogo oficial ANSV nítido" },
  { key: "estadisticas", nombre: "Estadísticas y tiempos", detalle: "Panel de rendimiento y tiempo ideal" },
  { key: "encuestas", nombre: "Encuestas de satisfacción", detalle: "Opiniones de los aspirantes" },
  { key: "emulador", nombre: "Emulador de examen", detalle: "Práctica para el personal" },
  { key: "importador", nombre: "Importador masivo", detalle: "Preguntas desde PDF / Excel / JSON" },
  { key: "ia", nombre: "Asistente con IA", detalle: "Genera opciones automáticamente" },
  { key: "actas_personalizadas", nombre: "Actas personalizadas", detalle: "Membrete y escudo propio" },
  { key: "turnos", nombre: "Turnos prácticos", detalle: "Asigna y notifica turnos del examen práctico" },
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
  "/admin/turnos": "turnos",
};

/** Cupo mensual de usos de IA: el valor manual del proveedor manda sobre el del plan. */
export const CUPO_IA_PLAN: Record<string, number> = { demo: 3, basico: 0, profesional: 15, enterprise: 60 };
export function cupoIA(plan: string, estado: string, manual: number | null | undefined): number {
  if (manual !== null && manual !== undefined) return manual;
  if (estado === "demo") return CUPO_IA_PLAN.demo;
  return CUPO_IA_PLAN[plan] ?? 0;
}

/** Precios de referencia en pesos argentinos (editables desde la consola). */
export const PRECIOS_ARS_DEFAULT: Record<PlanKey, number> = { basico: 45000, profesional: 95000, enterprise: 180000 };
export const formatoARS = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}
