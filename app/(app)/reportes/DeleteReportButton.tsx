"use client";

import { useState, useTransition } from "react";
import { deleteReport } from "./actions";

export default function DeleteReportButton({
  reportId,
  title,
}: {
  reportId: string;
  title: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function handleDelete() {
    if (!confirm(`¿Eliminar "${title}"? No se puede deshacer.`)) return;
    setError(null);
    start(async () => {
      try {
        await deleteReport(reportId);
      } catch (e) {
        // Sin este catch, el error del server action tumba la página entera
        // con "This page couldn't load".
        setError(e instanceof Error ? e.message : "No se pudo eliminar.");
      }
    });
  }

  return (
    <>
      <button
        className="btn btn-ghost"
        onClick={handleDelete}
        disabled={isPending}
        title="Eliminar reporte"
      >
        {isPending ? "…" : "Eliminar"}
      </button>
      {error && (
        <span style={{ fontSize: 12, color: "var(--flare, #ef4444)" }}>{error}</span>
      )}
    </>
  );
}
