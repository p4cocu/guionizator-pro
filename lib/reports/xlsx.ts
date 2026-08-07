/**
 * Generación del .xlsx de un reporte de competencia (exceljs).
 *
 * Tres hojas, en orden de utilidad para el cliente:
 *   1. Plan de grabación — lo accionable: qué grabar, por qué, con qué guion.
 *   2. Datos             — la tabla completa con métricas y transcripciones.
 *   3. Qué funciona      — agregado por gancho / estructura / pilar.
 *
 * SERVER-ONLY.
 */

import ExcelJS from "exceljs";
import type { CategoryBreakdown, ReportRow, ReportSnapshot } from "./snapshot";

// Paleta de marca (tokens de app/globals.css) en el formato ARGB que pide exceljs.
const INK = "FF0B1F17";
const EMERALD = "FF1F7A5A";
const SIGNAL = "FFE6B800";
const ZEBRA = "FFF3F6F4";

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
  row.alignment = { vertical: "middle", horizontal: "left" };
  row.height = 24;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function typeLabel(type: string | null): string {
  switch (type) {
    case "video":
      return "Reel";
    case "carousel":
      return "Carrusel";
    case "image":
      return "Imagen";
    default:
      return type ?? "";
  }
}

/** Motivo legible de por qué el post entró al reporte. */
function whyItWorks(row: ReportRow): string {
  const bits: string[] = [];
  if (row.post.isOutlier && row.post.outlierMultiple) {
    bits.push(`${row.post.outlierMultiple}× los comentarios habituales de la cuenta`);
  }
  if (row.post.engagementRate != null) {
    bits.push(`${row.post.engagementRate}% de engagement sobre followers`);
  }
  if (row.classification.notes) bits.push(row.classification.notes);
  return bits.join(" · ");
}

export async function buildReportXlsx(snapshot: ReportSnapshot): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Guionizator Pro";
  wb.created = new Date(snapshot.generatedAt);

  // ── Hoja 1: Plan de grabación ──────────────────────────────────────────────
  const plan = wb.addWorksheet("Plan de grabación", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  plan.columns = [
    { header: "#", key: "n", width: 5 },
    { header: "Cuenta", key: "cuenta", width: 20 },
    { header: "Por qué funcionó", key: "porque", width: 46 },
    { header: "Tipo de gancho", key: "gancho", width: 20 },
    { header: "Estructura", key: "estructura", width: 20 },
    { header: "Gancho del guion adaptado", key: "hook", width: 50 },
    { header: "¿Guion listo?", key: "listo", width: 14 },
    { header: "Estado de grabación", key: "estado", width: 20 },
    { header: "Link al post", key: "link", width: 42 },
  ];
  styleHeader(plan.getRow(1));

  snapshot.rows.forEach((r, i) => {
    const row = plan.addRow({
      n: i + 1,
      cuenta: `@${r.post.username}`,
      porque: whyItWorks(r),
      gancho: r.classification.hookTypeLabel ?? "Sin clasificar",
      estructura: r.classification.scriptStructureLabel ?? "Sin clasificar",
      hook: r.script?.hook ?? "— falta adaptar —",
      listo: r.script ? "Sí" : "No",
      estado: "Pendiente",
      link: r.post.permalink ?? "",
    });
    row.alignment = { vertical: "top", wrapText: true };
    if (i % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    }
    if (r.post.isOutlier) {
      row.getCell("porque").font = { bold: true, color: { argb: EMERALD } };
    }
    if (r.post.permalink) {
      row.getCell("link").value = { text: "Ver post", hyperlink: r.post.permalink };
      row.getCell("link").font = { color: { argb: "FF0563C1" }, underline: true };
    }
  });

  // ── Hoja 2: Datos ──────────────────────────────────────────────────────────
  const datos = wb.addWorksheet("Datos", { views: [{ state: "frozen", ySplit: 1 }] });
  datos.columns = [
    { header: "Cuenta", key: "cuenta", width: 20 },
    { header: "Publicado", key: "fecha", width: 14 },
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Link", key: "link", width: 14 },
    { header: "Likes", key: "likes", width: 10 },
    { header: "Comentarios", key: "comentarios", width: 13 },
    { header: "Vistas", key: "vistas", width: 12 },
    { header: "Followers", key: "followers", width: 12 },
    { header: "Engagement %", key: "engagement", width: 14 },
    { header: "× vs. mediana", key: "multiplo", width: 14 },
    { header: "¿Transcrito?", key: "transcrito", width: 13 },
    { header: "Transcripción", key: "transcripcion", width: 70 },
    { header: "Descripción del post", key: "caption", width: 50 },
    { header: "Tipo de gancho", key: "gancho", width: 20 },
    { header: "Estructura", key: "estructura", width: 20 },
    { header: "Pilar de valor", key: "pilar", width: 20 },
    { header: "Notas de la IA", key: "notas", width: 46 },
  ];
  styleHeader(datos.getRow(1));

  snapshot.rows.forEach((r, i) => {
    const transcription = (r.post.transcription ?? "").trim();
    const row = datos.addRow({
      cuenta: `@${r.post.username}`,
      fecha: formatDate(r.post.postedAt),
      tipo: typeLabel(r.post.type),
      link: "",
      likes: r.post.likes,
      comentarios: r.post.comments,
      vistas: r.post.videoViews ?? "",
      followers: r.post.followers ?? "",
      engagement: r.post.engagementRate ?? "",
      multiplo: r.post.outlierMultiple ?? "",
      transcrito: transcription ? "Sí" : "No",
      transcripcion: transcription,
      caption: r.post.caption ?? "",
      gancho: r.classification.hookTypeLabel ?? "",
      estructura: r.classification.scriptStructureLabel ?? "",
      pilar: r.classification.valuePillarLabel ?? "",
      notas: r.classification.notes ?? "",
    });
    row.alignment = { vertical: "top", wrapText: true };
    if (i % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    }
    if (r.post.permalink) {
      row.getCell("link").value = { text: "Ver post", hyperlink: r.post.permalink };
      row.getCell("link").font = { color: { argb: "FF0563C1" }, underline: true };
    }
    if (!transcription) {
      row.getCell("transcrito").font = { color: { argb: "FF9A6700" } };
    }
  });

  datos.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: datos.columns.length } };

  // ── Hoja 3: Qué está funcionando ───────────────────────────────────────────
  const stats = wb.addWorksheet("Qué está funcionando");
  stats.columns = [
    { header: "Dimensión", key: "dimension", width: 22 },
    { header: "Categoría", key: "categoria", width: 30 },
    { header: "Posts", key: "posts", width: 10 },
    { header: "Vistas promedio", key: "vistas", width: 18 },
    { header: "Engagement promedio", key: "engagement", width: 22 },
  ];
  styleHeader(stats.getRow(1));

  function addBreakdown(dimension: string, items: CategoryBreakdown[]) {
    if (items.length === 0) return;
    const title = stats.addRow({ dimension, categoria: "", posts: "", vistas: "", engagement: "" });
    title.font = { bold: true, color: { argb: EMERALD } };
    for (const it of items) {
      stats.addRow({
        dimension: "",
        categoria: it.label,
        posts: it.count,
        vistas: it.avgViews ?? "",
        engagement: it.avgEngagement,
      });
    }
    stats.addRow({});
  }

  addBreakdown("Tipo de gancho", snapshot.stats.hookType);
  addBreakdown("Estructura de guion", snapshot.stats.scriptStructure);
  addBreakdown("Pilar de valor", snapshot.stats.valuePillar);

  if (
    snapshot.stats.hookType.length === 0 &&
    snapshot.stats.scriptStructure.length === 0 &&
    snapshot.stats.valuePillar.length === 0
  ) {
    const note = stats.addRow({
      dimension: "Sin datos",
      categoria: "Ningún post de este reporte está clasificado todavía.",
    });
    note.font = { italic: true, color: { argb: "FF9A6700" } };
  }

  // Resumen al pie
  stats.addRow({});
  const resumen = stats.addRow({
    dimension: "Resumen",
    categoria: `${snapshot.stats.totalPosts} posts · ${snapshot.stats.withTranscription} transcritos · ${snapshot.stats.withScript} con guion adaptado`,
  });
  resumen.font = { bold: true };
  resumen.getCell("dimension").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: SIGNAL },
  };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
