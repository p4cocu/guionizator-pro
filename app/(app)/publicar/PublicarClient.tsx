"use client";

import { useState, useCallback, useRef } from "react";
import styles from "./publicar.module.css";

type Client = { id: string; nombre: string; marca: string | null };
type Account = { id: string; ig_user_id: string; username: string; client_id: string | null };
type UploadedFile = { name: string; url: string; path: string; type: "image" | "video" | "cover" };
type ContentType = "carousel" | "reel";

function detectContentType(files: File[]): ContentType {
  return files.some((f) => f.type.startsWith("video/")) ? "reel" : "carousel";
}

function sortByNumericPrefix(files: File[]): File[] {
  return [...files].sort((a, b) => {
    const numA = parseInt(a.name.match(/(\d+)/)?.[1] ?? "999");
    const numB = parseInt(b.name.match(/(\d+)/)?.[1] ?? "999");
    return numA - numB;
  });
}

function classifyFile(file: File, allFiles: File[]): "video" | "cover" | "image" {
  if (file.type.startsWith("video/")) return "video";
  if (allFiles.some((f) => f.type.startsWith("video/"))) return "cover";
  return "image";
}

export default function PublicarClient({
  clients,
  accounts,
}: {
  clients: Client[];
  accounts: Account[];
}) {
  const [clientId, setClientId] = useState("");
  const [scriptId, setScriptId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [contentType, setContentType] = useState<ContentType>("carousel");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [feedback, setFeedback] = useState("");
  const [step, setStep] = useState<"files" | "copy" | "publish">("files");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const filteredAccounts = accounts.filter(
    (a) => !clientId || a.client_id === clientId || !a.client_id
  );

  const handleFiles = useCallback((incoming: FileList | File[]) => {
    const arr = sortByNumericPrefix(Array.from(incoming));
    setRawFiles(arr);
    setContentType(detectContentType(arr));
    setUploadedFiles([]);
    setStep("files");
    setCaption("");
    setHashtags("");
    setError("");
    setSuccessMsg("");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) handleFiles(e.target.files);
    },
    [handleFiles]
  );

  async function uploadFiles() {
    if (!rawFiles.length) return;
    setLoading(true);
    setLoadingMsg("Subiendo archivos…");
    setError("");

    const form = new FormData();
    for (const f of rawFiles) form.append("files", f);

    const res = await fetch("/api/publish/upload", { method: "POST", body: form });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error subiendo archivos");
      return;
    }

    const classified: UploadedFile[] = data.files.map(
      (f: { name: string; url: string; path: string }, i: number) => ({
        ...f,
        type: classifyFile(rawFiles[i], rawFiles),
      })
    );
    setUploadedFiles(classified);
    setStep("copy");
  }

  async function generateCopy(withFeedback = false) {
    if (!clientId) { setError("Selecciona un cliente primero"); return; }
    setLoading(true);
    setLoadingMsg("Generando copy con Claude…");
    setError("");

    const res = await fetch("/api/publish/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        scriptId: scriptId || undefined,
        contentType,
        feedback: withFeedback ? feedback : undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error ?? "Error generando copy"); return; }
    setCaption(data.caption);
    setHashtags(data.hashtags);
    setFeedback("");
  }

  async function publish() {
    if (!accountId) { setError("Selecciona una cuenta de Instagram"); return; }
    if (!caption.trim()) { setError("El caption no puede estar vacío"); return; }
    if (!uploadedFiles.length) { setError("Sube los archivos primero"); return; }

    setLoading(true);
    setLoadingMsg(
      contentType === "reel"
        ? "Publicando Reel… (puede tardar 1–2 min mientras Instagram procesa el video)"
        : "Publicando carrusel… Instagram necesita ~10 seg para procesar las imágenes"
    );
    setError("");

    const res = await fetch("/api/publish/instagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        contentType,
        mediaFiles: uploadedFiles.map((f) => ({ url: f.url, type: f.type })),
        caption,
        hashtags,
        scriptId: scriptId || undefined,
        tempPaths: uploadedFiles.map((f) => f.path),
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error ?? "Error al publicar"); return; }

    setSuccessMsg(`¡Publicado en @${data.username}! ID: ${data.publishedId}`);
    setStep("files");
    setRawFiles([]);
    setUploadedFiles([]);
    setCaption("");
    setHashtags("");
    setScriptId("");
  }

  const typeLabel = contentType === "carousel" ? "Carrusel" : "Reel";

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <span className="eyebrow">Solo localhost</span>
        <h1 className={styles.title}>Publicar contenido</h1>
        <p className={styles.subtitle}>
          Sube tus archivos, genera el copy con IA y publica directamente en Instagram.
        </p>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}
      {successMsg && <div className={styles.successBanner}>{successMsg}</div>}

      {/* Configuración */}
      <section className="card">
        <h2 className={styles.sectionTitle}>Configuración</h2>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className="field-label">Cliente</label>
            <select
              className="input"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setAccountId(""); }}
            >
              <option value="">— Selecciona cliente —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.marca ?? c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className="field-label">Cuenta Instagram</label>
            <select
              className="input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={!clientId}
            >
              <option value="">— Selecciona cuenta —</option>
              {filteredAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.username}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className="field-label">ID del guion (opcional)</label>
            <input
              className="input"
              placeholder="p. ej. abc-123"
              value={scriptId}
              onChange={(e) => setScriptId(e.target.value.trim())}
            />
          </div>
        </div>
      </section>

      {/* Paso 1 — Archivos */}
      <section className="card">
        <h2 className={styles.sectionTitle}>
          <span className={styles.stepBadge}>1</span> Archivos
          {rawFiles.length > 0 && (
            <span className={`badge badge--emerald ${styles.typeBadge}`}>{typeLabel}</span>
          )}
        </h2>

        <div
          ref={dropRef}
          className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
            className={styles.fileInput}
            onChange={onInputChange}
          />
          {rawFiles.length === 0 ? (
            <>
              <span className={styles.dropIcon}>⬆</span>
              <p>Arrastra los archivos aquí o haz clic para seleccionar</p>
              <p className={styles.dropHint}>
                Carrusel: imágenes numeradas (1.jpg, 2.jpg…) · Reel: video + portada
              </p>
            </>
          ) : (
            <div className={styles.fileList}>
              {rawFiles.map((f, i) => (
                <div key={i} className={styles.fileChip}>
                  <span className={styles.fileOrder}>{i + 1}</span>
                  <span className={styles.fileName}>{f.name}</span>
                  <span className={styles.fileType}>
                    {f.type.startsWith("video/") ? "VIDEO" : "IMG"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {rawFiles.length > 0 && step === "files" && (
          <button
            className="btn btn-primary"
            onClick={uploadFiles}
            disabled={loading}
          >
            {loading ? loadingMsg : "Subir archivos →"}
          </button>
        )}

        {uploadedFiles.length > 0 && (
          <p className={styles.uploadedNote}>
            ✓ {uploadedFiles.length} archivo{uploadedFiles.length !== 1 ? "s" : ""} subidos y listos
          </p>
        )}
      </section>

      {/* Paso 2 — Copy */}
      {step !== "files" && (
        <section className="card">
          <h2 className={styles.sectionTitle}>
            <span className={styles.stepBadge}>2</span> Copy
          </h2>

          {!caption ? (
            <button
              className="btn btn-primary"
              onClick={() => generateCopy(false)}
              disabled={loading || !clientId}
            >
              {loading ? loadingMsg : "Generar copy con Claude →"}
            </button>
          ) : (
            <div className={styles.copyBlock}>
              <div className={styles.field}>
                <label className="field-label">Caption</label>
                <textarea
                  className="textarea"
                  rows={6}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className="field-label">Hashtags</label>
                <textarea
                  className="textarea"
                  rows={3}
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                />
              </div>

              <div className={styles.feedbackRow}>
                <input
                  className="input"
                  placeholder="¿Qué cambiarías? (opcional)"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && feedback) generateCopy(true); }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => generateCopy(!!feedback)}
                  disabled={loading}
                >
                  {loading ? "…" : "Regenerar"}
                </button>
              </div>

              <button
                className="btn btn-ghost"
                onClick={() => setStep("publish")}
              >
                Confirmar copy →
              </button>
            </div>
          )}
        </section>
      )}

      {/* Paso 3 — Publicar */}
      {step === "publish" && (
        <section className="card">
          <h2 className={styles.sectionTitle}>
            <span className={styles.stepBadge}>3</span> Publicar
          </h2>
          <div className={styles.publishSummary}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Tipo</span>
              <span>{typeLabel}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Archivos</span>
              <span>{uploadedFiles.length} archivo{uploadedFiles.length !== 1 ? "s" : ""}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Cuenta</span>
              <span>@{accounts.find((a) => a.id === accountId)?.username ?? "—"}</span>
            </div>
            {scriptId && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Guion</span>
                <span className={styles.summaryId}>{scriptId}</span>
              </div>
            )}
          </div>

          <button
            className={`btn btn-primary ${styles.publishBtn}`}
            onClick={publish}
            disabled={loading || !accountId}
          >
            {loading ? loadingMsg : `Publicar ${typeLabel} en Instagram`}
          </button>

          {contentType === "reel" && (
            <p className={styles.reelNote}>
              Los Reels pueden tardar 1–2 minutos en procesarse antes de publicarse.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
