"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExternalPublication } from "../actions";
import { findPostByPublicId } from "../../competencia/actions";
import { looksLikePublicId, normalizePublicId, PUBLIC_ID_LENGTH } from "@/lib/competencia/publicId";
import { COPY_PLATFORMS } from "@/lib/ai/copyPrompt";
import styles from "../guiones.module.css";

/**
 * "Ya grabé el video" — registrar una publicación hecha FUERA de la app para
 * sacarle el copy y la portada (migración `0014`).
 *
 * El caso real: Paco ve un reel de la competencia, se queda con la idea, graba
 * y edita el video entero por fuera, y recién al momento de publicar necesita
 * el copy. Hasta acá no había forma de entrar: los dos paneles cuelgan de un
 * `script_id` y solo existía si el guion se había generado en la app.
 *
 * No genera nada acá: crea la ficha y manda a `/guiones/<id>?autogen=1`, donde
 * los paneles de siempre se disparan solos. Así no hay una segunda copia de la
 * generación de copy ni de portadas que mantener.
 */
type Cliente = { id: string; nombre: string; marca: string | null };

type RefState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "found"; username: string; clientName: string }
  | { phase: "missing" };

export default function NuevaPublicacionForm({
  clientes,
  initialClientId,
}: {
  clientes: Cliente[];
  initialClientId?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(
    initialClientId && clientes.some((c) => c.id === initialClientId)
      ? initialClientId
      : (clientes[0]?.id ?? ""),
  );
  const [type, setType] = useState<"reel" | "carousel">("reel");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [publicId, setPublicId] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [refState, setRefState] = useState<RefState>({ phase: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * Busca el ID mientras se escribe, apenas está completo. Va contra TODAS las
   * marcas del dueño a propósito: el reel que inspiró el video puede estar
   * guardado en el tablero de otra marca.
   */
  async function checkReference(value: string) {
    const normalized = normalizePublicId(value);
    if (!looksLikePublicId(normalized)) {
      setRefState({ phase: "idle" });
      return;
    }
    setRefState({ phase: "checking" });
    try {
      const hit = await findPostByPublicId(normalized);
      setRefState(
        hit
          ? { phase: "found", username: hit.username, clientName: hit.clientName }
          : { phase: "missing" },
      );
    } catch {
      setRefState({ phase: "missing" });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId) {
      setError("Elige la marca de la publicación.");
      return;
    }
    if (!context.trim()) {
      setError("Contá de qué trata el video para poder escribir el copy.");
      return;
    }
    startTransition(async () => {
      try {
        const { id } = await createExternalPublication({
          client_id: clientId,
          type,
          title,
          context,
          source_public_id: publicId,
        });
        // `autogen=1` abre y dispara Copy Expert y Portadas al llegar.
        router.push(`/guiones/${id}?autogen=1&platform=${platform}`);
      } catch (err) {
        // Sin este catch, un fallo del server action deja la pantalla
        // "This page couldn't load" en vez de un mensaje (regla de CLAUDE.md).
        setError(err instanceof Error ? err.message : "No se pudo crear la publicación.");
      }
    });
  }

  return (
    <form className="card" style={{ padding: 24 }} onSubmit={handleSubmit}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px", lineHeight: 1.6 }}>
        Para un video o carrusel que ya grabaste por fuera. Cuéntame de qué trata
        y te devuelvo el copy en dos versiones y tres ideas de portada, con el
        contexto de la marca.
      </p>

      <div style={{ display: "grid", gap: 18 }}>
        <div>
          <label className="field-label" htmlFor="pub-cliente">
            Marca
          </label>
          <select
            id="pub-cliente"
            className="input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.marca || c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Formato</label>
          <div className={styles.typeToggle}>
            <button
              type="button"
              className={`${styles.typeBtn} ${type === "reel" ? styles.active : ""}`}
              onClick={() => setType("reel")}
            >
              Reel
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${type === "carousel" ? styles.active : ""}`}
              onClick={() => setType("carousel")}
            >
              Carrusel
            </button>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="pub-titulo">
            Título interno <span style={{ opacity: 0.6 }}>(opcional)</span>
          </label>
          <input
            id="pub-titulo"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Cómo cobro un proyecto web"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="pub-contexto">
            ¿De qué trata el video?
          </label>
          <textarea
            id="pub-contexto"
            className="textarea"
            rows={7}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={
              "Lo que dijiste, el ángulo y a quién le hablas. Mientras más concreto, mejor sale el copy.\n\nEj: Explico por qué cobrar por hora te deja sin margen, con el ejemplo del cliente que pidió 4 rondas de cambios, y cierro invitando a cotizar por proyecto."
            }
          />
        </div>

        <div>
          <label className="field-label" htmlFor="pub-ref">
            ID del post que te inspiró <span style={{ opacity: 0.6 }}>(opcional)</span>
          </label>
          <input
            id="pub-ref"
            className="input"
            value={publicId}
            maxLength={PUBLIC_ID_LENGTH + 2}
            style={{ fontFamily: "var(--font-mono, monospace)", textTransform: "uppercase", maxWidth: 220 }}
            onChange={(e) => {
              const v = normalizePublicId(e.target.value);
              setPublicId(v);
              void checkReference(v);
            }}
            placeholder="Q7F2M9"
          />
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
            El código de 6 caracteres de la tarjeta en Competencia. Se usa solo
            como referencia de ángulo y ritmo: el copy habla de tu proyecto, no
            del suyo.
          </p>
          {refState.phase === "checking" && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>Buscando…</p>
          )}
          {refState.phase === "found" && (
            <p style={{ fontSize: 12, color: "var(--emerald, #2fbf87)", marginTop: 6 }}>
              ✓ @{refState.username} — guardado en {refState.clientName}
            </p>
          )}
          {refState.phase === "missing" && (
            <p style={{ fontSize: 12, color: "var(--flare)", marginTop: 6 }}>
              No encontré ese ID. Puedes continuar igual: la publicación se crea
              sin referencia.
            </p>
          )}
        </div>

        <div>
          <label className="field-label">Copy para</label>
          <div className={styles.typeToggle}>
            {COPY_PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`${styles.typeBtn} ${platform === p.id ? styles.active : ""}`}
                onClick={() => !p.soon && setPlatform(p.id)}
                disabled={p.soon}
                title={p.soon ? "Próximamente" : undefined}
                style={p.soon ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              >
                {p.label}
                {p.soon ? " · pronto" : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p style={{ color: "var(--flare)", fontSize: 13, margin: "16px 0 0" }}>{error}</p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? "Creando…" : "✦ Crear y generar copy + portada"}
        </button>
      </div>
    </form>
  );
}
