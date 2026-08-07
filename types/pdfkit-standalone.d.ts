/**
 * Tipos para el build "standalone" de pdfkit.
 *
 * Se importa `pdfkit/js/pdfkit.standalone.js` en vez de `pdfkit` porque el
 * entry normal lee sus métricas de fuente (.afm) del disco con
 * `fs.readFileSync(__dirname + "/data/…")`. Al bundlear la ruta en la Netlify
 * Function esa ruta deja de existir y revienta en runtime con:
 *   ENOENT: no such file or directory, open '/ROOT/node_modules/pdfkit/js/data/Helvetica.afm'
 * El standalone trae esas métricas embebidas (2.4 MB vs 206 KB) y no toca disco.
 *
 * @types/pdfkit solo declara el módulo "pdfkit", así que reexportamos su tipo
 * para la ruta del standalone.
 */
declare module "pdfkit/js/pdfkit.standalone.js" {
  import PDFDocument from "pdfkit";
  export default PDFDocument;
}
