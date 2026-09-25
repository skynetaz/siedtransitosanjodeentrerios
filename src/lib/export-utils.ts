// Utilidades cliente para exportar exámenes a PDF y Excel.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { etiquetaExamen, nombreCategoria, clasesDeExamen } from "@/lib/categoria-label";


export type ExamDetail = {
  exam: any;
  preguntas: Array<{
    orden: number;
    pregunta: string;
    tema?: string | null;
    eliminatoria?: boolean;
    respuesta_dada: string | null;
    respuesta_correcta: string;
    correcta: boolean | null;
  }>;
};

function datosDe(d: ExamDetail) {
  const p = d.exam.profiles ?? {};
  const datos = (d.exam.datos_aspirante ?? {}) as any;
  return {
    nombre: datos.nombre ?? p.nombre ?? "",
    apellido: datos.apellido ?? p.apellido ?? "",
    dni: datos.dni ?? p.dni ?? "",
    email: datos.email ?? p.email ?? "",
    telefono: datos.telefono ?? p.telefono ?? "",
  };
}

const esImagenSenal = (valor?: string | null) => Boolean(valor?.startsWith("/senales/"));

async function imagenComoDataUrl(src: string): Promise<string | null> {
  try {
    const response = await fetch(src, { cache: "force-cache" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportExamPDF(d: ExamDetail) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const info = datosDe(d);
  const ex = d.exam;
  const rutasSenales = Array.from(new Set(
    d.preguntas.flatMap((p) => [p.respuesta_dada, p.respuesta_correcta]).filter((v): v is string => esImagenSenal(v)),
  ));
  const imagenes = new Map<string, string>();
  await Promise.all(rutasSenales.map(async (ruta) => {
    const dataUrl = await imagenComoDataUrl(ruta);
    if (dataUrl) imagenes.set(ruta, dataUrl);
  }));

  // Acta compacta: pensada para entrar en 2 hojas A4.
  const M = 28; // margen en puntos
  const ANCHO = 595 - M * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Dirección de Tránsito — Examen de Licencia de Conducir", M, 30);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Examen: ${etiquetaExamen(ex)}   Estado: ${(ex.status ?? "").toUpperCase()}   Fecha: ${ex.finished_at ? new Date(ex.finished_at).toLocaleString("es-AR") : "—"}`, M, 43);
  doc.text(`${info.apellido}, ${info.nombre} — DNI ${info.dni}   ${info.email || "—"} · ${info.telefono || "—"}`, M, 54);
  doc.text(
    `Correctas: ${ex.correctas ?? 0} / ${ex.total_preguntas ?? 0}   Incorrectas: ${ex.incorrectas ?? 0}` +
      (ex.eliminado_por_pregunta ? "   Desaprobado por pregunta eliminatoria." : ""),
    M,
    65,
  );
  doc.setDrawColor(200);
  doc.line(M, 71, 595 - M, 71);

  const LADO_SENAL = 22; // lado de la miniatura de señal, en puntos

  autoTable(doc, {
    startY: 78,
    head: [["#", "Pregunta", "Respuesta del aspirante", "Correcta esperada", "OK"]],
    body: d.preguntas.map((p) => [
      String(p.orden),
      p.pregunta + (p.eliminatoria ? " [E]" : ""),
      esImagenSenal(p.respuesta_dada) ? "" : (p.respuesta_dada ?? "—"),
      esImagenSenal(p.respuesta_correcta) ? "" : p.respuesta_correcta,
      p.correcta === true ? "Sí" : p.correcta === false ? "No" : "—",
    ]),
    styles: { fontSize: 6.2, cellPadding: 1.5, valign: "top", overflow: "linebreak", lineWidth: 0.3 },
    headStyles: { fillColor: [15, 23, 42], fontSize: 6.4, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      2: { cellWidth: ANCHO * 0.2 },
      3: { cellWidth: ANCHO * 0.2 },
      4: { cellWidth: 18, halign: "center" },
    },
    margin: { left: M, right: M, top: 24, bottom: 24 },
    didParseCell: (hook) => {
      if (hook.section !== "body") return;
      const pregunta = d.preguntas[hook.row.index];
      if (pregunta && (esImagenSenal(pregunta.respuesta_dada) || esImagenSenal(pregunta.respuesta_correcta))) {
        hook.cell.styles.minCellHeight = LADO_SENAL + 4;
      }
    },
    didDrawCell: (hook) => {
      if (hook.section !== "body" || (hook.column.index !== 2 && hook.column.index !== 3)) return;
      const pregunta = d.preguntas[hook.row.index];
      if (!pregunta) return;
      const ruta = hook.column.index === 2 ? pregunta.respuesta_dada : pregunta.respuesta_correcta;
      if (!ruta || !esImagenSenal(ruta)) return;
      const imagen = imagenes.get(ruta);
      if (!imagen) return;
      const lado = Math.min(LADO_SENAL, hook.cell.height - 3, hook.cell.width - 3);
      doc.addImage(imagen, "JPEG", hook.cell.x + 2, hook.cell.y + 2, lado, lado);
    },
  });

  const afterTableY = (doc as any).lastAutoTable?.finalY ?? 400;
  const ALTO_FIRMA = 56;
  let y = afterTableY + 16;
  if (y + ALTO_FIRMA + 30 > 812) { doc.addPage(); y = 40; }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Firma del aspirante", M, y);
  doc.text("Firma y aval del inspector", 310, y);
  doc.setDrawColor(120);
  doc.rect(M, y + 6, 230, ALTO_FIRMA);
  doc.rect(310, y + 6, 230, ALTO_FIRMA);
  if (ex.signature_aspirante) {
    try { doc.addImage(ex.signature_aspirante, "PNG", M + 2, y + 8, 226, ALTO_FIRMA - 4); } catch {}
  }
  if (ex.signature_inspector) {
    try { doc.addImage(ex.signature_inspector, "PNG", 312, y + 8, 226, ALTO_FIRMA - 4); } catch {}
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`${info.apellido}, ${info.nombre} — DNI ${info.dni}`, M, y + ALTO_FIRMA + 16);
  doc.text(ex.signed_inspector_at ? `Firmado ${new Date(ex.signed_inspector_at).toLocaleString("es-AR")}` : "Pendiente de firma", 310, y + ALTO_FIRMA + 16);

  const filename = `examen_${info.apellido || "aspirante"}_${info.dni || ex.id.slice(0,8)}.pdf`;
  doc.save(filename);
}

export function exportExamExcel(d: ExamDetail) {
  const info = datosDe(d);
  const ex = d.exam;
  const wb = XLSX.utils.book_new();

  const header = [
    ["Examen de Licencia de Conducir"],
    ["Examen", nombreCategoria(ex), "Clases", clasesDeExamen(ex), "Estado", ex.status, "Fecha", ex.finished_at ? new Date(ex.finished_at).toLocaleString("es-AR") : ""],
    [],
    ["Apellido", info.apellido, "Nombre", info.nombre],
    ["DNI", info.dni, "Correo", info.email, "Teléfono", info.telefono],
    [],
    ["Correctas", ex.correctas ?? 0, "Incorrectas", ex.incorrectas ?? 0, "Total", ex.total_preguntas ?? 0],
    [],
    ["#", "Tema", "Pregunta", "Eliminatoria", "Respuesta dada", "Respuesta correcta", "OK"],
  ];
  const rows = d.preguntas.map((p) => [
    p.orden, p.tema ?? "", p.pregunta, p.eliminatoria ? "Sí" : "No",
    p.respuesta_dada ?? "", p.respuesta_correcta, p.correcta === true ? "Sí" : p.correcta === false ? "No" : "",
  ]);
  const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  ws["!cols"] = [{ wch: 4 }, { wch: 16 }, { wch: 60 }, { wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 6 }];
  XLSX.utils.book_append_sheet(wb, ws, "Examen");
  XLSX.writeFile(wb, `examen_${info.apellido || "aspirante"}_${info.dni || ex.id.slice(0,8)}.xlsx`);
}

// Export de una lista (para /admin/estadisticas o /admin/archivo)
export function exportListExcel(rows: any[], filename = "examenes.xlsx") {
  const flat = rows.map((r) => ({
    fecha: r.finished_at ? new Date(r.finished_at).toLocaleString("es-AR") : "",
    apellido: r.profiles?.apellido ?? r.datos_aspirante?.apellido ?? "",
    nombre: r.profiles?.nombre ?? r.datos_aspirante?.nombre ?? "",
    dni: r.profiles?.dni ?? r.datos_aspirante?.dni ?? "",
    examen: nombreCategoria(r),
    clases: clasesDeExamen(r),

    estado: r.status,
    correctas: r.correctas ?? 0,
    incorrectas: r.incorrectas ?? 0,
    total: r.total_preguntas ?? 0,
    firma_aspirante: r.signature_aspirante ? "Sí" : "No",
    firma_inspector: r.signature_inspector ? "Sí" : "No",
  }));
  const ws = XLSX.utils.json_to_sheet(flat);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Exámenes");
  XLSX.writeFile(wb, filename);
}

// ===== Vista previa de categoría → PDF (descargar / compartir / imprimir) =====
const esRutaSenal = (v?: string | null) =>
  Boolean(v && (v.startsWith("/senales/") || v.startsWith("/api/public/senal/")));

/** Carga cualquier imagen (jpg/png/webp/svg) y la devuelve como JPEG en data URL. */
async function imagenJpeg(src: string): Promise<string | null> {
  return await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 256; c.height = 256;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 256, 256);
        const s = Math.min(256 / (img.naturalWidth || 256), 256 / (img.naturalHeight || 256));
        const w = (img.naturalWidth || 256) * s, h = (img.naturalHeight || 256) * s;
        ctx.drawImage(img, (256 - w) / 2, (256 - h) / 2, w, h);
        resolve(c.toDataURL("image/jpeg", 0.9));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export type CategoriaPdfPregunta = {
  pregunta: string; clase: string; tema: string | null; peso: number;
  eliminatoria: boolean; correcta: string; opciones: string[];
};

export async function crearPdfCategoria(
  cat: { nombre: string; clases: string[]; duracion_minutos: number; max_errores: number },
  preguntas: CategoriaPdfPregunta[],
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const rutas = Array.from(new Set(preguntas.flatMap((p) => p.opciones).filter(esRutaSenal)));
  const imgs = new Map<string, string>();
  await Promise.all(rutas.map(async (r) => { const d = await imagenJpeg(r); if (d) imgs.set(r, d); }));

  const M = 36, W = 595 - M * 2, BOTTOM = 842 - 36;
  let y = 40;
  const nueva = (alto: number) => { if (y + alto > BOTTOM) { doc.addPage(); y = 40; } };

  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(`Vista previa · ${cat.nombre || "Categoría"}`, M, y); y += 15;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  const elim = preguntas.filter((p) => p.eliminatoria).length;
  const puntaje = preguntas.reduce((a, p) => a + (p.peso || 0), 0);
  doc.text(
    `Clases ${cat.clases.join(" + ")} · ${cat.duracion_minutos} min · hasta ${cat.max_errores} errores · ` +
      `${preguntas.length} preguntas · ${elim} eliminatorias · puntaje ${puntaje} · ${new Date().toLocaleString("es-AR")}`,
    M, y,
  );
  y += 8; doc.setDrawColor(200); doc.line(M, y, 595 - M, y); y += 14;

  preguntas.forEach((p, i) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    const enc = `${i + 1}. ${p.pregunta}${p.eliminatoria ? "  [ELIMINATORIA]" : ""}`;
    const lineas = doc.splitTextToSize(enc, W);
    nueva(lineas.length * 11 + 16);
    doc.text(lineas, M, y); y += lineas.length * 11;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text(`Clase ${p.clase}${p.tema ? " · " + p.tema : ""} · peso ${p.peso}`, M, y); y += 10;
    doc.setTextColor(0);

    const conImg = p.opciones.some(esRutaSenal);
    if (conImg) {
      const L = 62; nueva(L + 16);
      p.opciones.forEach((o, k) => {
        const x = M + k * (L + 12);
        const ok = o === p.correcta;
        const d = imgs.get(o);
        if (d) doc.addImage(d, "JPEG", x, y, L, L);
        else if (!esRutaSenal(o)) doc.text(doc.splitTextToSize(o, L), x, y + 10);
        if (ok) { doc.setDrawColor(22, 163, 74); doc.setLineWidth(2); doc.rect(x - 2, y - 2, L + 4, L + 4); doc.setLineWidth(0.5); }
        doc.setFontSize(7); doc.text(`${String.fromCharCode(65 + k)}${ok ? " (correcta)" : ""}`, x, y + L + 10);
      });
      y += L + 18;
    } else {
      doc.setFontSize(8.5);
      p.opciones.forEach((o, k) => {
        const ok = o === p.correcta;
        const t = doc.splitTextToSize(`${String.fromCharCode(65 + k)}) ${o}${ok ? "   (correcta)" : ""}`, W - 10);
        nueva(t.length * 10 + 2);
        if (ok) { doc.setFont("helvetica", "bold"); doc.setTextColor(22, 120, 60); }
        doc.text(t, M + 8, y); y += t.length * 10;
        doc.setFont("helvetica", "normal"); doc.setTextColor(0);
      });
      y += 8;
    }
  });

  const nombreArchivo = `vista_previa_${(cat.nombre || "categoria").replace(/[^\w]+/g, "_")}.pdf`;
  return { doc, nombreArchivo };
}
