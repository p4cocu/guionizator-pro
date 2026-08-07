/**
 * Generación del PDF ejecutivo de un reporte de competencia (pdfkit).
 *
 * Estructura: portada → hallazgos ("qué grabar y por qué") → los guiones
 * adaptados completos, listos para grabar.
 *
 * Por qué pdfkit y no @react-pdf/renderer: este código termina bundleado en una
 * Netlify Function y @react-pdf/renderer arrastra yoga-layout (WASM), que es
 * frágil de empaquetar. pdfkit es JS puro con las fuentes estándar embebidas.
 * Contrapartida: no usa Space Grotesk (las fuentes de marca vienen de Google
 * vía next/font, no hay TTF en el repo) — se usa Helvetica.
 *
 * SERVER-ONLY.
 */

// Se importa el build STANDALONE a propósito: el entry normal de pdfkit lee sus
// métricas de fuente (.afm) del disco con `fs.readFileSync(__dirname + …)`, y al
// bundlear esta ruta en la Netlify Function esa ruta ya no existe → ENOENT en
// runtime (pasó en producción el 2026-08-07). El standalone las trae embebidas.
// Ver types/pdfkit-standalone.d.ts.
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { ReportRow, ReportSnapshot } from "./snapshot";

// Paleta de marca en hex (tokens de app/globals.css).
const INK = "#0B1F17";
const FOREST = "#123D2C";
const EMERALD = "#1F7A5A";
const SIGNAL = "#E6B800";
const MUTED = "#6B7C74";

const MARGIN = 56;
const PAGE_WIDTH = 595.28; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function typeLabel(type: string | null): string {
  if (type === "video") return "Reel";
  if (type === "carousel") return "Carrusel";
  if (type === "image") return "Imagen";
  return type ?? "";
}

type Doc = InstanceType<typeof PDFDocument>;

/** Salta de página si no queda espacio para `needed` puntos. */
function ensureSpace(doc: Doc, needed: number) {
  if (doc.y + needed > doc.page.height - MARGIN) doc.addPage();
}

function sectionTitle(doc: Doc, text: string) {
  ensureSpace(doc, 60);
  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(15).fillColor(INK).text(text, MARGIN, doc.y);
  const y = doc.y + 4;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + 46, y).lineWidth(2.5).strokeColor(SIGNAL).stroke();
  doc.moveDown(0.9);
}

function metricsLine(row: ReportRow): string {
  const bits = [
    `${row.post.likes.toLocaleString("es-MX")} likes`,
    `${row.post.comments.toLocaleString("es-MX")} comentarios`,
    row.post.videoViews != null ? `${row.post.videoViews.toLocaleString("es-MX")} vistas` : null,
    row.post.engagementRate != null ? `${row.post.engagementRate}% engagement` : null,
  ].filter(Boolean);
  return bits.join("  ·  ");
}

export function buildReportPdf(snapshot: ReportSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Portada ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_WIDTH, 260).fill(INK);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(SIGNAL)
      .text("REPORTE DE COMPETENCIA", MARGIN, 80, { characterSpacing: 1.6 });
    doc
      .font("Helvetica-Bold")
      .fontSize(30)
      .fillColor("#FFFFFF")
      .text(snapshot.client.marca || snapshot.client.nombre, MARGIN, 108, {
        width: CONTENT_WIDTH,
      });

    const periodo =
      snapshot.period.start || snapshot.period.end
        ? `${formatDate(snapshot.period.start)} — ${formatDate(snapshot.period.end)}`
        : `Generado el ${formatDate(snapshot.generatedAt)}`;
    doc.font("Helvetica").fontSize(11).fillColor("#B9CFC5").text(periodo, MARGIN, doc.y + 8);

    doc.y = 300;
    doc.fillColor(INK);

    // Resumen en 3 números
    const cards = [
      { n: String(snapshot.stats.totalPosts), label: "posts analizados" },
      { n: String(snapshot.stats.withScript), label: "guiones listos para grabar" },
      { n: String(snapshot.stats.withTranscription), label: "transcritos" },
    ];
    // Y fija para las 3 tarjetas: dibujarlas dejando que `doc.y` avance solo
    // obliga a rebobinarlo entre tarjeta y tarjeta, que es donde se rompe.
    const cardW = (CONTENT_WIDTH - 24) / 3;
    const cardH = 76;
    const cardY = doc.y;
    cards.forEach((c, i) => {
      const x = MARGIN + i * (cardW + 12);
      doc.roundedRect(x, cardY, cardW, cardH, 8).fillAndStroke("#F3F6F4", "#DCE5E0");
      doc
        .font("Helvetica-Bold")
        .fontSize(26)
        .fillColor(EMERALD)
        .text(c.n, x, cardY + 16, { width: cardW, align: "center" });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(MUTED)
        .text(c.label, x, cardY + 50, { width: cardW, align: "center" });
    });

    doc.y = cardY + cardH + 30;
    doc.fillColor(INK);

    // ── Qué grabar y por qué ─────────────────────────────────────────────────
    sectionTitle(doc, "Qué grabar y por qué");

    if (snapshot.rows.length === 0) {
      doc.font("Helvetica").fontSize(11).fillColor(MUTED).text("Sin posts en este reporte.");
    }

    snapshot.rows.forEach((r, i) => {
      ensureSpace(doc, 110);
      const top = doc.y;

      doc.font("Helvetica-Bold").fontSize(12).fillColor(INK);
      doc.text(`${i + 1}. @${r.post.username}`, MARGIN, top, { continued: false });

      if (r.post.isOutlier && r.post.outlierMultiple) {
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(EMERALD)
          .text(`DESTACADO · ${r.post.outlierMultiple}× los comentarios habituales de la cuenta`, {
            width: CONTENT_WIDTH,
          });
      }

      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(metricsLine(r), {
        width: CONTENT_WIDTH,
      });

      const tags = [
        r.classification.hookTypeLabel,
        r.classification.scriptStructureLabel,
        r.classification.valuePillarLabel,
      ].filter(Boolean);
      if (tags.length) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor(FOREST).text(tags.join("  ·  "), {
          width: CONTENT_WIDTH,
        });
      }

      if (r.classification.notes) {
        doc.moveDown(0.25);
        doc.font("Helvetica-Oblique").fontSize(10).fillColor(INK).text(r.classification.notes, {
          width: CONTENT_WIDTH,
        });
      }

      if (r.post.permalink) {
        doc.moveDown(0.2);
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#0563C1")
          .text("Ver post original", { link: r.post.permalink, underline: true });
      }

      doc.moveDown(0.9);
    });

    // ── Guiones listos para grabar ───────────────────────────────────────────
    const withScript = snapshot.rows.filter((r) => r.script != null);
    if (withScript.length > 0) {
      doc.addPage();
      sectionTitle(doc, "Guiones listos para grabar");

      withScript.forEach((r, i) => {
        const script = r.script!;
        ensureSpace(doc, 160);

        doc
          .font("Helvetica-Bold")
          .fontSize(13)
          .fillColor(INK)
          .text(script.title || `Guion ${i + 1}`, { width: CONTENT_WIDTH });

        const meta = [
          typeLabel(script.type === "carousel" ? "carousel" : "video"),
          script.structureName,
          `inspirado en @${r.post.username}`,
        ]
          .filter(Boolean)
          .join("  ·  ");
        doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(meta, { width: CONTENT_WIDTH });

        doc.moveDown(0.5);
        doc
          .font("Helvetica")
          .fontSize(11)
          .fillColor(INK)
          .text(script.text || "(guion vacío)", {
            width: CONTENT_WIDTH,
            align: "left",
            lineGap: 3,
          });

        if (r.post.permalink) {
          doc.moveDown(0.3);
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#0563C1")
            .text("Post de referencia", { link: r.post.permalink, underline: true });
        }

        doc.moveDown(1.2);
      });
    }

    // ── Pie de página en todas las páginas ───────────────────────────────────
    // El pie se dibuja por DEBAJO del margen inferior. pdfkit interpreta eso
    // como que el texto no cabe y agrega una página nueva (una por pie, todas
    // en blanco). Poner el margen inferior en 0 mientras se escribe evita el
    // salto; `lineBreak: false` blinda el caso de un nombre de marca largo.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          `${snapshot.client.marca || snapshot.client.nombre}  ·  Reporte de competencia  ·  ${i + 1}/${range.count}`,
          MARGIN,
          doc.page.height - 38,
          { width: CONTENT_WIDTH, align: "center", lineBreak: false },
        );
      doc.page.margins.bottom = bottom;
    }

    doc.end();
  });
}
