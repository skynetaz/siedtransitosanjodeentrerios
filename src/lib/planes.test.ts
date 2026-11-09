import { describe, it, expect } from "vitest";
import { featuresDePlan, featureActiva, diasRestantesDemo } from "./planes";

describe("planes", () => {
  it("básico no incluye emulador", () => expect(featuresDePlan("basico").emulador).toBe(false));
  it("enterprise incluye todo", () => expect(Object.values(featuresDePlan("enterprise")).every(Boolean)).toBe(true));
  it("flag apagado deshabilita", () => expect(featureActiva({ emulador: false }, "emulador")).toBe(false));
  it("demo de 14 días", () => expect(diasRestantesDemo("2026-01-15T00:00:00Z", new Date("2026-01-01T00:00:00Z"))).toBe(14));
});

import { cupoIA as _cupo } from "./planes";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("cupo de IA", () => {
  i2("demo tiene 3 usos", () => e2(_cupo("enterprise", "demo", null)).toBe(3));
  i2("profesional 15 y enterprise 60", () => { e2(_cupo("profesional", "activa", null)).toBe(15); e2(_cupo("enterprise", "activa", null)).toBe(60); });
  i2("el cupo manual manda", () => e2(_cupo("basico", "activa", 25)).toBe(25));
});
