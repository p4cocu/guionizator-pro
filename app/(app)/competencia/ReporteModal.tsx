"use client";

import { useState } from "react";
import Link from "next/link";
import type { CompetitorPost } from "./actions";
import s from "./competencia.module.css";

type Props = {
  clientId: string;
  clientName: string;
  posts: CompetitorPost[];
  onClose: () => void;
};

type Created = {
  id: string;
  title: string;
  post_count: number;
  stats: { withScript: number; withTranscription: number };
};

/** Fecha de hoy en YYYY-MM-DD, en hora local (no UTC: `toISOString` corre el día). */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ReporteModal({ clientId, clientName, posts, onClose }: Props) {
  const [title, setTitle] = useState(`Reporte de competencia — ${clientName}`);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState(today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const sinTranscripcion = posts.filter((p) => !(p.transcription ?? "").trim()).length;
  const sinClasificar = posts.filter((p) => !p.classified_at).length;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          post_ids: posts.map((p) => p.id),
          title: title.trim(),
          period_start: periodStart || null,
          period_end: periodEnd || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo generar el reporte.");
      setCreated(json as Created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el reporte.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHead}>
          <div>
            <h3>Generar reporte</h3>
            <p className={s.modalSub}>
              {posts.length} post{posts.length === 1 ? "" : "s"} seleccionado
              {posts.length === 1 ? "" : "s"} · {clientName}
            </p>
          </div>
          <button className={s.modalClose} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className={s.modalBody}>
          {!created ? (
            <>
              <div className={s.modalField}>
                <label className="field-label">Título del reporte</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Reporte de competencia"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className={s.modalField}>
                  <label className="field-label">Periodo — desde</label>
                  <input
                    className="input"
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className={s.modalField}>
                  <label className="field-label">Periodo — hasta</label>
                  <input
                    className="input"
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>

              {(sinTranscripcion > 0 || sinClasificar > 0) && (
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--signal)",
                    background: "rgba(230,184,0,0.08)",
                    border: "1px solid rgba(230,184,0,0.25)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    marginTop: 4,
                  }}
                >
                  {sinTranscripcion > 0 && (
                    <>
                      {sinTranscripcion} de {posts.length} sin transcripción.{" "}
                    </>
                  )}
                  {sinClasificar > 0 && <>{sinClasificar} sin clasificar. </>}
                  El reporte los incluye igual, pero esas columnas van vacías. El snapshot
                  se congela al generar: si los transcribes después, hay que regenerarlo.
                </p>
              )}
            </>
          ) : (
            <div>
              <p style={{ fontSize: 14, marginBottom: 4 }}>
                Reporte creado con {created.post_count} post
                {created.post_count === 1 ? "" : "s"}.
              </p>
              <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>
                {created.stats.withScript} con guion adaptado ·{" "}
                {created.stats.withTranscription} transcritos
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a
                  className="btn btn-primary"
                  href={`/api/reports/${created.id}/xlsx`}
                  style={{ fontSize: 13 }}
                >
                  Descargar Excel
                </a>
                <a
                  className="btn btn-secondary"
                  href={`/api/reports/${created.id}/pdf`}
                  style={{ fontSize: 13 }}
                >
                  Descargar PDF
                </a>
                <Link className="btn btn-ghost" href="/reportes" style={{ fontSize: 13 }}>
                  Ver historial
                </Link>
              </div>
            </div>
          )}

          {error && <p className={s.modalError}>{error}</p>}
        </div>

        {!created && (
          <div className={s.modalFoot}>
            <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={loading || posts.length === 0}
              style={{ fontSize: 13 }}
            >
              {loading ? "Generando…" : "Generar reporte"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
