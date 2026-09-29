/**
 * La "ficha de oferta" de un producto o servicio (migración `0016`).
 *
 * Fuente de verdad de los campos: la UI de `/clientes/[id]` los dibuja desde
 * acá, el prompt los arma desde acá y la extracción desde una landing los pide
 * desde acá. Agregar un campo = columna nueva en `client_products` (sin CHECK)
 * + una entrada en `PRODUCT_FIELD_GROUPS`.
 *
 * Módulo puro: lo importan componentes cliente, server actions y rutas.
 */

// `client_products.tipo` SÍ tiene CHECK en la base (`producto`, `servicio`).
export type ProductTipo = "producto" | "servicio";

export type ProductFieldKey =
  | "para_quien"
  | "problema"
  | "beneficios"
  | "proceso"
  | "diferenciador"
  | "objeciones"
  | "prueba_social"
  | "oferta"
  | "garantia"
  | "cta";

export type ProductField = {
  key: ProductFieldKey;
  label: string;
  /** Ejemplo corto: va de placeholder del textarea. */
  placeholder: string;
  /** Cómo se rotula el dato dentro del prompt. */
  promptLabel: string;
  rows: number;
};

export type ProductFieldGroup = {
  id: "base" | "persuasion" | "oferta";
  label: string;
  hint: string;
  fields: ProductField[];
};

export const PRODUCT_FIELD_GROUPS: ProductFieldGroup[] = [
  {
    id: "base",
    label: "Base",
    hint: "Lo mínimo para que la IA entienda qué vendes y a quién.",
    fields: [
      {
        key: "para_quien",
        label: "¿Para quién es?",
        placeholder: "Dueños de negocio local que venden por WhatsApp y no tienen tiempo de contestar…",
        promptLabel: "Para quién es",
        rows: 2,
      },
      {
        key: "problema",
        label: "¿Qué problema resuelve?",
        placeholder: "Pierden ventas porque tardan horas en responder mensajes…",
        promptLabel: "Problema que resuelve",
        rows: 2,
      },
      {
        key: "beneficios",
        label: "Beneficios / resultado",
        placeholder: "Responde en segundos 24/7, agenda citas solo, libera 2 horas diarias…",
        promptLabel: "Beneficios y resultado",
        rows: 3,
      },
      {
        key: "proceso",
        label: "¿Cómo se inicia? (el proceso)",
        placeholder: "1) Llamada de diagnóstico de 20 min 2) Configuramos en 7 días 3) Acompañamiento 30 días…",
        promptLabel: "Cómo se inicia y cómo es el proceso",
        rows: 3,
      },
    ],
  },
  {
    id: "persuasion",
    label: "Persuasión",
    hint: "Lo que convierte un guion informativo en uno que vende.",
    fields: [
      {
        key: "diferenciador",
        label: "¿Qué lo hace distinto?",
        placeholder: "No es un chatbot genérico: se entrena con tus conversaciones reales…",
        promptLabel: "Diferenciador",
        rows: 2,
      },
      {
        key: "objeciones",
        label: "Objeciones frecuentes y cómo las respondes",
        placeholder: "“Mis clientes van a notar que es un bot” → responde con tu tono y pasa a humano cuando hace falta…",
        promptLabel: "Objeciones frecuentes y su respuesta",
        rows: 3,
      },
      {
        key: "prueba_social",
        label: "Resultados reales / prueba social",
        placeholder: "Clínica dental X pasó de 40 a 70 citas al mes. 25 negocios activos…",
        promptLabel: "Resultados reales y prueba social",
        rows: 3,
      },
    ],
  },
  {
    id: "oferta",
    label: "Oferta",
    hint: "Para el cierre: qué se ofrece y qué tiene que hacer la persona.",
    fields: [
      {
        key: "oferta",
        label: "Precio u oferta actual",
        placeholder: "Desde $3,500 MXN/mes. Este mes, configuración sin costo…",
        promptLabel: "Precio u oferta vigente",
        rows: 2,
      },
      {
        key: "garantia",
        label: "Garantía",
        placeholder: "Si en 30 días no ves resultados, te devolvemos el dinero…",
        promptLabel: "Garantía",
        rows: 2,
      },
      {
        key: "cta",
        label: "CTA principal",
        placeholder: "Escribe “BOT” por DM / agenda en el link de la bio…",
        promptLabel: "CTA principal (a dónde mandar a la gente)",
        rows: 2,
      },
    ],
  },
];

export const PRODUCT_FIELDS: ProductField[] = PRODUCT_FIELD_GROUPS.flatMap((g) => g.fields);

export const PRODUCT_FIELD_KEYS: ProductFieldKey[] = PRODUCT_FIELDS.map((f) => f.key);

export type ProductDetails = Record<ProductFieldKey, string | null>;

export type Product = {
  id: string;
  client_id: string;
  nombre: string;
  descripcion: string | null;
  tipo: ProductTipo;
  created_at: string;
} & ProductDetails;

/** `select()` de Supabase con todas las columnas que usa la ficha. */
export const PRODUCT_COLUMNS = [
  "id",
  "client_id",
  "nombre",
  "descripcion",
  "tipo",
  "created_at",
  ...PRODUCT_FIELD_KEYS,
].join(", ");

/** Tope por campo. Es un prompt, no un documento: 2000 caracteres es de sobra. */
export const PRODUCT_FIELD_MAX = 2000;

/**
 * Los campos que más cambian el contenido. Si falta alguno, "Nuevo guion" hace
 * 1-2 preguntas de afinado antes de generar.
 */
export const KEY_PRODUCT_FIELDS: ProductFieldKey[] = [
  "para_quien",
  "problema",
  "proceso",
  "objeciones",
  "cta",
];

export function productFieldLabel(key: ProductFieldKey): string {
  return PRODUCT_FIELDS.find((f) => f.key === key)?.label ?? key;
}

export function isProductFieldKey(value: string): value is ProductFieldKey {
  return (PRODUCT_FIELD_KEYS as string[]).includes(value);
}

function filled(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** 0–100 sobre los 10 campos de la ficha (la descripción no cuenta). */
export function productCompleteness(p: Partial<ProductDetails>): number {
  const n = PRODUCT_FIELD_KEYS.filter((k) => filled(p[k])).length;
  return Math.round((n / PRODUCT_FIELD_KEYS.length) * 100);
}

export function missingKeyFields(p: Partial<ProductDetails>): ProductFieldKey[] {
  return KEY_PRODUCT_FIELDS.filter((k) => !filled(p[k]));
}

/**
 * Único camino de escritura de la ficha: recorta, vacío → `null`, tope de
 * largo y descarta claves desconocidas (el objeto viene del browser).
 */
export function sanitizeProductDetails(raw: Record<string, unknown>): Partial<ProductDetails> {
  const out: Partial<ProductDetails> = {};
  for (const key of PRODUCT_FIELD_KEYS) {
    if (!(key in raw)) continue;
    const v = raw[key];
    const text = typeof v === "string" ? v.trim().slice(0, PRODUCT_FIELD_MAX) : "";
    out[key] = text.length > 0 ? text : null;
  }
  return out;
}

/** Lo que necesita un selector de servicio (sin mandar la ficha entera al browser). */
export type ProductOption = {
  id: string;
  client_id: string;
  nombre: string;
  tipo: ProductTipo;
  completeness: number;
  missing: ProductFieldKey[];
};

export function toProductOption(p: Product): ProductOption {
  return {
    id: p.id,
    client_id: p.client_id,
    nombre: p.nombre,
    tipo: p.tipo,
    completeness: productCompleteness(p),
    missing: missingKeyFields(p),
  };
}

export function emptyProductDetails(): ProductDetails {
  return Object.fromEntries(PRODUCT_FIELD_KEYS.map((k) => [k, null])) as ProductDetails;
}
