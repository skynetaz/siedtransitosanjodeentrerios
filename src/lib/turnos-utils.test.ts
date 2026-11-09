import { describe, it, expect } from "vitest";
import { contactoValido, calcularDesde, formatoApellidoNombre, decidirEstado } from "./turnos-utils";
describe("turnos", () => {
  it("descarta correo @aspirante.local", () => expect(contactoValido("123@aspirante.local", null).email).toBeNull());
  it("normaliza teléfono con 0 y 15", () => expect(contactoValido(null, "0343 15 4123456").telefono).toBe("5493434123456"));
  it("sin contacto", () => expect(contactoValido("", "").sinContacto).toBe(true));
  it("desde usa hora argentina", () => expect(calcularDesde(1, new Date("2026-11-10T02:30:00Z"))).toBe("2026-11-09T23:30"));
  it("apellido primero en mayúsculas", () => expect(formatoApellidoNombre("Pérez", "Juan")).toBe("PÉREZ JUAN"));
  it("decide estado", () => {
    expect(decidirEstado({ ok: true, reserva: { hoja: "x", fila: 2, fecha: "2026-11-19", hora: "14:00" } }).estado).toBe("asignado");
    expect(decidirEstado({ ok: true, reserva: null, motivo: "sin_cupo" }).motivo).toBe("sin_cupo");
    expect(decidirEstado(null).motivo).toBe("error_hoja");
  });
});
