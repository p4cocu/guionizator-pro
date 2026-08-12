import { MODEL_DEFAULT } from "@/lib/ai/anthropic";
import { AiJsonError, generateJson } from "@/lib/ai/json";

export const RESOURCE_CATEGORIES = [
  "Prompt Claude",
  "Prompt Imagen",
  "Prompt Video",
  "Guía",
  "Herramienta",
  "Otro",
] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export type ClientLite = {
  id: string;
  nombre: string;
  nicho?: string | null;
  que_vende?: string | null;
  cliente_ideal?: string | null;
  dolor?: string | null;
  deseo?: string | null;
};

export type ClassifiedResource = {
  category: ResourceCategory;
  title: string;
  summary: string | null;
  prompt_text: string | null;
  tags: string[];
  client_id: string | null;
  client_auto: boolean;
};

// ── Lectura de links ──────────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trae el contenido legible de una URL (título, descripción y texto visible).
 * Best-effort: links de video/redes con JS pueden devolver poco; tolera fallos.
 */
export async function fetchUrlText(
  url: string,
): Promise<{ pageText: string | null; pageTitle: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return { pageText: null, pageTitle: null };
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) {
      return { pageText: null, pageTitle: null };
    }
    const html = await res.text();
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() || null;
    const desc =
      html.match(
        /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']+)["']/i,
      )?.[1] ?? "";
    const body = htmlToText(html);
    const combined = [title, desc, body].filter(Boolean).join("\n").slice(0, 6000);
    return { pageText: combined || null, pageTitle: title };
  } catch {
    return { pageText: null, pageTitle: null };
  }
}

// ── Clasificación con Claude ──────────────────────────────────────────────────

const CLASSIFIER_SYSTEM = `Eres un bibliotecario experto que organiza recursos de marketing e IA (prompts, links, guías, herramientas) que un creador de contenido recibe por mensajes de Instagram.

Tu trabajo: analizar el recurso y devolver SOLO un JSON válido (sin markdown, sin texto extra) con esta forma exacta:
{
  "category": "una de: Prompt Claude | Prompt Imagen | Prompt Video | Guía | Herramienta | Otro",
  "title": "título corto y descriptivo (≤ 8 palabras)",
  "summary": "2-3 frases en español latino, tuteo, explicando QUÉ es y PARA QUÉ sirve",
  "prompt_text": "si el recurso ES un prompt reutilizable, el texto del prompt limpio y listo para copiar; si no es un prompt, null",
  "tags": ["3-6 etiquetas en minúscula, una o dos palabras c/u, ej: n8n, hook, copywriting"],
  "client_id": "el id EXACTO de un cliente de la lista SOLO si el recurso aplica de forma evidente y casi 100% a ese cliente; si no, null",
  "client_confident": true solo si estás muy seguro del client_id, de lo contrario false
}

Reglas de categoría:
- "Prompt Claude": prompts de texto para LLMs/chatbots (Claude, GPT, etc.).
- "Prompt Imagen": prompts para generar imágenes (Midjourney, DALL·E, etc.).
- "Prompt Video": prompts para generar video (Sora, Runway, Veo, Kling, etc.).
- "Guía": tutoriales, hilos, artículos o explicaciones de cómo hacer algo.
- "Herramienta": apps, webs o servicios.
- "Otro": cualquier cosa que no encaje.

Sé estricto con el cliente: solo asígnalo si el tema del recurso coincide claramente con su nicho/qué vende. Ante la duda, client_id = null y client_confident = false.`;

function coerceCategory(v: unknown): ResourceCategory {
  return (RESOURCE_CATEGORIES as readonly string[]).includes(v as string)
    ? (v as ResourceCategory)
    : "Otro";
}

export async function classifyResource(input: {
  url?: string | null;
  text?: string | null;
  clients: ClientLite[];
}): Promise<ClassifiedResource> {
  const { url, text, clients } = input;

  let pageText: string | null = null;
  let pageTitle: string | null = null;
  if (url) {
    const r = await fetchUrlText(url);
    pageText = r.pageText;
    pageTitle = r.pageTitle;
  }

  const clientsBlock = clients.length
    ? clients
        .map(
          (c) =>
            `- id: ${c.id} | nombre: ${c.nombre}` +
            (c.nicho ? ` | nicho: ${c.nicho}` : "") +
            (c.que_vende ? ` | vende: ${c.que_vende}` : "") +
            (c.cliente_ideal ? ` | cliente ideal: ${c.cliente_ideal}` : ""),
        )
        .join("\n")
    : "(no hay clientes registrados)";

  const userMessage = `Clasifica este recurso recibido por Instagram.

${url ? `URL: ${url}` : "Sin URL (es texto directo)."}
${pageTitle ? `Título de la página: ${pageTitle}` : ""}
${pageText ? `Contenido del link:\n"""\n${pageText}\n"""` : ""}
${text ? `Texto enviado por el usuario:\n"""\n${text.trim()}\n"""` : ""}

Clientes disponibles (para el auto-tag, usa el id EXACTO):
${clientsBlock}

Responde SOLO con el JSON.`;

  let parsed: Record<string, unknown> = {};
  try {
    ({ data: parsed } = await generateJson({
      label: "classify-resource",
      userMessage,
      brainContent: CLASSIFIER_SYSTEM,
      model: MODEL_DEFAULT,
      maxTokens: 1024,
    }));
  } catch (e) {
    // Fallback mínimo si la IA no devolvió JSON válido ni en el reintento
    if (!(e instanceof AiJsonError)) throw e;
    parsed = {};
  }

  const validIds = new Set(clients.map((c) => c.id));
  const rawClientId = typeof parsed.client_id === "string" ? parsed.client_id : null;
  const clientConfident = parsed.client_confident === true;
  const client_id = rawClientId && validIds.has(rawClientId) && clientConfident ? rawClientId : null;

  const tags = Array.isArray(parsed.tags)
    ? (parsed.tags as unknown[])
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return {
    category: coerceCategory(parsed.category),
    title:
      (typeof parsed.title === "string" && parsed.title.trim()) ||
      pageTitle ||
      (text ? text.trim().slice(0, 60) : "Recurso sin título"),
    summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : null,
    prompt_text:
      typeof parsed.prompt_text === "string" && parsed.prompt_text.trim()
        ? parsed.prompt_text.trim()
        : null,
    tags,
    client_id,
    client_auto: client_id != null,
  };
}
