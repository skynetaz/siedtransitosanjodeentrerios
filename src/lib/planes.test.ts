import { describe, it, expect } from "vitest";
import { featuresDePlan, featureActiva, diasRestantesDemo } from "./planes";

describe("planes", () => {
  it("básico no incluye emulador", () => expect(featuresDePlan("basico").emulador).toBe(false));
  it("enterprise incluye todo", () => expect(Object.values(featuresDePlan("enterprise")).every(Boolean)).toBe(true));
  it("flag apagado deshabilita", () => expect(featureActiva({ emulador: false }, "emulador")).toBe(false));
  it("demo de 14 días", () => expect(diasRestantesDemo("2026-01-15T00:00:00Z", new Date("2026-01-01T00:00:00Z"))).toBe(14));
});
