// Funciones puras del módulo de turnos (sin dependencias de servidor).
export function contactoValido(email?: string | null, telefono?: string | null) {
  const e = (email ?? "").trim().toLowerCase();
  const emailOk = e && !e.endsWith("@aspirante.local") && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
  let d = (telefono ?? "").replace(/\D/g, "");
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  // quitar "15" luego del código de área (2 a 4 dígitos)
  if (d.length === 12) { for (const n of [2, 3, 4]) if (d.slice(n, n + 2) === "15") { d = d.slice(0, n) + d.slice(n + 2); break; } }
  const tel = d.length === 10 ? "549" + d : null;
  return { email: emailOk, telefono: tel, sinContacto: !emailOk && !tel };
}

/** "AAAA-MM-DDTHH:mm" en hora de Argentina, sumando días. */
export function calcularDesde(dias: number, ahora = new Date()) {
  const t = new Date(ahora.getTime() + dias * 86400000);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(t).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function formatoApellidoNombre(apellido: string, nombre: string) {
  return `${apellido} ${nombre}`.replace(/\s+/g, " ").trim().toUpperCase();
}

export type RespuestaReserva = { ok: boolean; error?: string; reserva?: { hoja: string; fila: number; fecha: string; hora: string } | null; motivo?: string };
export function decidirEstado(r: RespuestaReserva | null) {
  if (!r || !r.ok) return { estado: "pendiente" as const, motivo: "error_hoja" };
  if (r.reserva) return { estado: "asignado" as const, motivo: null };
  return { estado: "pendiente" as const, motivo: r.motivo ?? "sin_cupo" };
}

export function armarMensajeTurno(t: { nombre: string; apellido: string; categoria: string; fecha: string; hora: string; lugar: string; reglas: string }) {
  const [y, m, d] = t.fecha.split("-").map(Number);
  const f = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
  return `Hola ${t.nombre} ${t.apellido}: ¡felicitaciones, aprobaste el examen teórico de ${t.categoria}!\nTu turno para el examen práctico es el ${f} a las ${t.hora.slice(0, 5)} hs.\n\nLugar: ${t.lugar}\n\n${t.reglas}`;
}

export function clasesDeExamen(clase?: string | null, incluidas?: string[] | null) {
  const v = [...(incluidas ?? []), clase ?? ""].map((c) => String(c).toUpperCase().trim()).filter((c) => /^[A-E]$/.test(c));
  return [...new Set(v)].sort();
}

const DIAS = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
function ddmmyyyy(f: string) { const [y, m, d] = f.split("-"); return `${d}/${m}/${y}`; }
function diaSemana(f: string) { const [y, m, d] = f.split("-").map(Number); return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; }

/** Mensaje oficial del turno práctico; agrupa una o varias clases del mismo aspirante. */
export function armarMensajeTurnos(t: { apellido: string; nombre: string; turnos: { clase: string; fecha: string; hora: string; anexo?: string | null }[]; lugar: string; reglas: string }) {
  const ts = [...t.turnos].filter((x) => x.fecha).sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
  const clases = ts.map((x) => x.clase.toUpperCase());
  const titulo = clases.length > 1 ? `CLASES ${clases.slice(0, -1).join(", ")} Y ${clases[clases.length - 1]}` : `CLASE ${clases[0] ?? ""}`;
  const dias = [...new Set(ts.map((x) => diaSemana(x.fecha)))];
  const diasTxt = dias.length > 1 ? `DÍAS ${dias.slice(0, -1).join(", ")} Y ${dias[dias.length - 1]}` : `DÍA ${dias[0] ?? ""}`;
  const sep = "______________________________";
  const bloques = ts.map((x, i) => `FECHA DE PRÁCTICA: ${ddmmyyyy(x.fecha)}${i === 0 ? `   ${diasTxt}` : ""}\nCLASE A RENDIR: *${x.clase.toUpperCase()}*   ANEXO: ${x.anexo ?? ""}\nHORA: ${String(x.hora ?? "").slice(0, 5)} HS\n${sep}`);
  return `*TURNO PRÁCTICO ${titulo}*\nAPELLIDO Y NOMBRE: ${formatoApellidoNombre(t.apellido, t.nombre)}\n${bloques.join("\n")}\nLugar: ${t.lugar}\n${t.reglas}`;
}
