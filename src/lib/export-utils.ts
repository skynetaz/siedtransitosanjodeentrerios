// Utilidades cliente para exportar exámenes a PDF y Excel.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Dirección de Tránsito — Examen de Licencia de Conducir", 40, 50);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Clase: ${ex.clase}   Estado: ${ex.status?.toUpperCase()}   Fecha: ${ex.finished_at ? new Date(ex.finished_at).toLocaleString("es-AR") : "—"}`, 40, 70);

  doc.setDrawColor(200);
  doc.line(40, 80, 555, 80);

  doc.setFont("helvetica", "bold");
  doc.text("Datos del aspirante", 40, 100);
  doc.setFont("helvetica", "normal");
  doc.text(`Apellido y Nombre: ${info.apellido}, ${info.nombre}`, 40, 118);
  doc.text(`DNI: ${info.dni}`, 40, 134);
  doc.text(`Correo: ${info.email || "—"}    Teléfono: ${info.telefono || "—"}`, 40, 150);

  doc.setFont("helvetica", "bold");
  doc.text("Resultado", 40, 176);
  doc.setFont("helvetica", "normal");
  doc.text(`Correctas: ${ex.correctas ?? 0} / ${ex.total_preguntas ?? 0}    Incorrectas: ${ex.incorrectas ?? 0}`, 40, 192);
  if (ex.eliminado_por_pregunta) doc.text("Desaprobado por pregunta eliminatoria.", 40, 208);

  autoTable(doc, {
    startY: 224,
    head: [["#", "Pregunta", "Respuesta del aspirante", "Correcta esperada", "OK"]],
    body: d.preguntas.map((p) => [
      String(p.orden),
      p.pregunta + (p.eliminatoria ? " [E]" : ""),
      esImagenSenal(p.respuesta_dada) ? "" : (p.respuesta_dada ?? "—"),
      esImagenSenal(p.respuesta_correcta) ? "" : p.respuesta_correcta,
      p.correcta === true ? "Sí" : p.correcta === false ? "No" : "—",
    ]),
    styles: { fontSize: 9, cellPadding: 4, valign: "top" },
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: { 0: { cellWidth: 24 }, 4: { cellWidth: 30, halign: "center" } },
    margin: { left: 40, right: 40 },
    didParseCell: (hook) => {
      if (hook.section !== "body") return;
      const pregunta = d.preguntas[hook.row.index];
      if (pregunta && (esImagenSenal(pregunta.respuesta_dada) || esImagenSenal(pregunta.respuesta_correcta))) {
        hook.cell.styles.minCellHeight = 66;
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
      const lado = Math.min(56, hook.cell.height - 8, hook.cell.width - 8);
      doc.addImage(imagen, "JPEG", hook.cell.x + 4, hook.cell.y + 4, lado, lado);
    },
  });

  const afterTableY = (doc as any).lastAutoTable?.finalY ?? 400;
  let y = afterTableY + 30;
  if (y > 720) { doc.addPage(); y = 60; }

  doc.setFont("helvetica", "bold");
  doc.text("Firma del aspirante", 60, y);
  doc.text("Firma y aval del inspector", 330, y);
  doc.setDrawColor(120);
  doc.rect(60, y + 10, 220, 80);
  doc.rect(330, y + 10, 220, 80);
  if (ex.signature_aspirante) {
    try { doc.addImage(ex.signature_aspirante, "PNG", 62, y + 12, 216, 76); } catch {}
  }
  if (ex.signature_inspector) {
    try { doc.addImage(ex.signature_inspector, "PNG", 332, y + 12, 216, 76); } catch {}
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${info.apellido}, ${info.nombre} — DNI ${info.dni}`, 60, y + 105);
  doc.text(ex.signed_inspector_at ? `Firmado ${new Date(ex.signed_inspector_at).toLocaleString("es-AR")}` : "Pendiente de firma", 330, y + 105);

  const filename = `examen_${info.apellido || "aspirante"}_${info.dni || ex.id.slice(0,8)}.pdf`;
  doc.save(filename);
}

export function exportExamExcel(d: ExamDetail) {
  const info = datosDe(d);
  const ex = d.exam;
  const wb = XLSX.utils.book_new();

  const header = [
    ["Examen de Licencia de Conducir"],
    ["Clase", ex.clase, "Estado", ex.status, "Fecha", ex.finished_at ? new Date(ex.finished_at).toLocaleString("es-AR") : ""],
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
    clase: r.clase,
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
