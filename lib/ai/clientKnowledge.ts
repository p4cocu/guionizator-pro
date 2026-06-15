import fs from "fs";
import path from "path";

/**
 * Carga el conocimiento de marca de un cliente desde la convención de carpeta
 * `knowledge/clients/<nombre>/`. Lee y concatena todos los `.md` de esa carpeta.
 *
 * El match del nombre es case-insensitive, así "FLUIA" coincide aunque el
 * `clients.nombre` venga con otra capitalización. Devuelve `null` si no existe
 * carpeta para el cliente o no hay `.md` adentro — en ese caso la generación cae
 * al campo `clients.tono` del perfil.
 */
export function loadClientKnowledge(clientNombre: string): string | null {
  const baseDir = path.join(process.cwd(), "knowledge", "clients");
  if (!fs.existsSync(baseDir)) return null;

  const target = clientNombre.trim().toLowerCase();
  if (!target) return null;

  let dir: string | null = null;
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.toLowerCase() === target) {
      dir = path.join(baseDir, entry.name);
      break;
    }
  }
  if (!dir) return null;

  const parts: string[] = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (f.toLowerCase().endsWith(".md")) {
      parts.push(fs.readFileSync(path.join(dir, f), "utf-8").trim());
    }
  }

  return parts.length ? parts.join("\n\n---\n\n") : null;
}
