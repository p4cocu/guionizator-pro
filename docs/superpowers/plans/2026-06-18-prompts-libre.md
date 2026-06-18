# Generación Libre de Prompts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/prompts/libre` page where the user writes free-form context, selects a visual style, and gets a professional image prompt instantly — no script selection, no scene analysis.

**Architecture:** New route `app/(app)/prompts/libre/` with a server `page.tsx` (fetches custom styles) and a client `LibreClient.tsx` (full UI). The existing `/api/ai/prompt-image` endpoint is reused unchanged. `PromptsClient.tsx` gets a single cross-link added. CSS reuses existing classes from `prompts.module.css`; two new utility classes are appended to that file.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, CSS Modules (`prompts.module.css`), existing `getPromptStyles()` server action, existing `POST /api/ai/prompt-image` endpoint.

## Global Constraints

- CSS Modules only — no Tailwind, no inline styles beyond minor `style={{}}` overrides already present in the codebase.
- No new Supabase tables, migrations, or API routes.
- No new npm dependencies.
- Text in Spanish latinoamericano (tuteo).
- Client components marked `"use client"` at top of file.
- No persistence — generate and copy only.

---

### Task 1: CSS additions for the libre page

**Files:**
- Modify: `app/(app)/prompts/prompts.module.css`

**Interfaces:**
- Produces CSS class names consumed by `LibreClient.tsx` in Task 2:
  - `.headerRow` — flex row with title left, link right
  - `.libreActions` — flex row for copy + regenerate buttons

All other classes needed by `LibreClient.tsx` already exist in `prompts.module.css`:
`.page`, `.header`, `.title`, `.subtitle`, `.formCard`, `.formSectionTitle`,
`.styleGrid`, `.styleCard`, `.styleCardActive`, `.styleCardCustom`, `.styleIcon`,
`.styleName`, `.styleDesc`, `.promptText`, `.descText`, `.loadingSpinner`,
`.resultEmpty`, `.resultEmptyText`, `.formError`, `.copiedBtn`.

- [ ] **Step 1: Append the two new classes to `prompts.module.css`**

Add at the very end of `app/(app)/prompts/prompts.module.css`:

```css
/* ── Libre page ── */
.headerRow {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.libreActions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
```

- [ ] **Step 2: Verify no CSS syntax errors**

```bash
cd "/Users/paco/Desktop/Claude Code/Contenido Redes/Guionizator Pro" && npm run build 2>&1 | grep -i "css\|error" | head -20
```

Expected: no CSS-related errors (other TS errors are fine at this stage).

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/prompts/prompts.module.css"
git commit -m "Style: clases headerRow y libreActions para página de prompts libre"
```

---

### Task 2: LibreClient component

**Files:**
- Create: `app/(app)/prompts/libre/LibreClient.tsx`

**Interfaces:**
- Consumes (from Task 1): `.headerRow`, `.libreActions` from `prompts.module.css`
- Consumes (existing CSS): `.page`, `.header`, `.title`, `.subtitle`, `.formCard`, `.formSectionTitle`, `.styleGrid`, `.styleCard`, `.styleCardActive`, `.styleCardCustom`, `.styleIcon`, `.styleName`, `.styleDesc`, `.promptText`, `.descText`, `.loadingSpinner`, `.resultEmpty`, `.resultEmptyText`, `.formError`, `.copiedBtn`
- Consumes (existing type): `PromptStyle` from `../../prompts/actions` — `{ id: string; name: string; description: string | null; base_style: string | null; style_tokens: string | null; ... }`
- Consumes (existing endpoint): `POST /api/ai/prompt-image` — body `{ medium: string; subject: string; action: string; environment: string; style_vibe: string; technical_specs: string; base_style: string; style_tokens?: string }` → response `{ prompt_en: string; description_es: string }`
- Produces: `export default function LibreClient({ customStyles }: { customStyles: PromptStyle[] })` — consumed by Task 3's `page.tsx`

- [ ] **Step 1: Create the file with types, constants, and state**

Create `app/(app)/prompts/libre/LibreClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { PromptStyle } from "../../prompts/actions";
import s from "../prompts.module.css";

const PRESET_STYLES = [
  {
    id: "realistic",
    name: "Hiperrealista",
    description: "Fotografía hiperrealista con física de lente, iluminación natural y texturas auténticas",
    base_style: "realistic",
    style_tokens: null as string | null,
    icon: "📸",
  },
  {
    id: "pixar",
    name: "Pixar 3D",
    description: "Render 3D estilo Pixar con subsurface scattering, iluminación global y proporciones expresivas",
    base_style: "pixar",
    style_tokens: null as string | null,
    icon: "🎬",
  },
  {
    id: "cinematic",
    name: "Cinemático",
    description: "Fotografía cinematográfica con dirección de arte, color grade y tokens de directores referentes",
    base_style: "cinematic",
    style_tokens: null as string | null,
    icon: "🎞",
  },
];

type Result = { prompt_en: string; description_es: string };

export default function LibreClient({ customStyles }: { customStyles: PromptStyle[] }) {
  const allStyles = [
    ...PRESET_STYLES.map((st) => ({ ...st, isCustom: false })),
    ...customStyles.map((cs) => ({
      id: cs.id,
      name: cs.name,
      description: cs.description ?? "",
      base_style: cs.base_style ?? "custom",
      style_tokens: cs.style_tokens,
      icon: "✦",
      isCustom: true,
    })),
  ];

  const [selectedStyleId, setSelectedStyleId] = useState("realistic");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedStyle = allStyles.find((st) => st.id === selectedStyleId) ?? allStyles[0];
```

- [ ] **Step 2: Add the generate and copy handlers**

Append to `LibreClient.tsx` (still inside the component, after the state declarations):

```tsx
  async function handleGenerate() {
    if (!context.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/prompt-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medium: "",
          subject: context.trim(),
          action: "",
          environment: "",
          style_vibe: "",
          technical_specs: "9:16 vertical, Instagram",
          base_style: selectedStyle.base_style,
          style_tokens: selectedStyle.style_tokens ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error generando prompt");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.prompt_en);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
```

- [ ] **Step 3: Add the JSX return**

Append to `LibreClient.tsx` (closing the component):

```tsx
  return (
    <div className={s.page}>
      {/* ── Header ── */}
      <div className={s.headerRow}>
        <div className={s.header}>
          <p className="eyebrow">Prompting</p>
          <h2 className={s.title}>Generación libre de prompts</h2>
          <p className={s.subtitle}>
            Describí lo que querés visualizar y elegí un estilo. Sin preguntas — el prompt aparece directo.
          </p>
        </div>
        <Link href="/prompts" className="btn btn-ghost" style={{ flexShrink: 0, marginTop: 8 }}>
          ← Desde guion
        </Link>
      </div>

      {/* ── Style selector ── */}
      <div className={`card ${s.formCard}`}>
        <p className={s.formSectionTitle}>Estilo visual</p>
        <div className={s.styleGrid}>
          {allStyles.map((st) => (
            <button
              key={st.id}
              className={`${s.styleCard} ${st.isCustom ? s.styleCardCustom : ""} ${selectedStyleId === st.id ? s.styleCardActive : ""}`}
              onClick={() => setSelectedStyleId(st.id)}
            >
              <span className={s.styleIcon}>{st.icon}</span>
              <span className={s.styleName}>{st.name}</span>
            </button>
          ))}
        </div>
        {selectedStyle.description && (
          <p className={s.styleDesc}>{selectedStyle.description}</p>
        )}
      </div>

      {/* ── Context input ── */}
      <div className={`card ${s.formCard}`}>
        <p className={s.formSectionTitle}>Contexto</p>
        <div className="field">
          <label className="field-label">
            Describí lo que querés visualizar
          </label>
          <textarea
            className="textarea"
            rows={5}
            placeholder="Personaje, escenario, acción, ambiente, mood… Todo el contexto que puedas dar, mejor."
            value={context}
            onChange={(e) => setContext(e.target.value)}
            disabled={loading}
          />
        </div>
        {error && <p className={s.formError}>{error}</p>}
        <button
          className="btn btn-primary"
          style={{ alignSelf: "flex-start", padding: "12px 28px" }}
          onClick={handleGenerate}
          disabled={loading || !context.trim()}
        >
          {loading ? "Generando…" : result ? "↺ Regenerar" : "✦ Generar prompt"}
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className={`card ${s.resultEmpty}`}>
          <div className={s.loadingSpinner} />
          <p className={s.resultEmptyText}>Generando tu prompt…</p>
        </div>
      )}

      {/* ── Result ── */}
      {result && !loading && (
        <div className={`card ${s.formCard}`}>
          <p className={s.formSectionTitle}>Prompt generado</p>
          <p className={s.promptText}>{result.prompt_en}</p>
          <div className={s.libreActions}>
            <button
              className={`btn btn-primary ${copied ? s.copiedBtn : ""}`}
              style={{ padding: "10px 20px" }}
              onClick={handleCopy}
            >
              {copied ? "¡Copiado!" : "Copiar prompt"}
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: "10px 20px" }}
              onClick={handleGenerate}
              disabled={loading}
            >
              ↺ Regenerar
            </button>
          </div>
          <p className={s.descText}>{result.description_es}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "/Users/paco/Desktop/Claude Code/Contenido Redes/Guionizator Pro" && npm run build 2>&1 | tail -20
```

Expected: build succeeds or any errors are NOT in `LibreClient.tsx`. Fix any type errors in that file before continuing.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/prompts/libre/LibreClient.tsx"
git commit -m "Feat: componente LibreClient para generación libre de prompts"
```

---

### Task 3: Server page + cross-link in PromptsClient

**Files:**
- Create: `app/(app)/prompts/libre/page.tsx`
- Modify: `app/(app)/prompts/PromptsClient.tsx` (add one cross-link)

**Interfaces:**
- Consumes (from Task 2): `LibreClient` default export from `./LibreClient`
- Consumes (existing): `getPromptStyles` from `../actions` → `Promise<PromptStyle[]>`
- Consumes (existing): `PromptsClient.tsx` header section — the `<div className={s.header}>` block starting at line 305

- [ ] **Step 1: Create `app/(app)/prompts/libre/page.tsx`**

```tsx
import { getPromptStyles } from "../actions";
import LibreClient from "./LibreClient";

export default async function PromptsLibrePage() {
  const customStyles = await getPromptStyles();
  return <LibreClient customStyles={customStyles} />;
}
```

- [ ] **Step 2: Add cross-link in `PromptsClient.tsx`**

In `app/(app)/prompts/PromptsClient.tsx`, find the header section:

```tsx
      {/* ── Header ── */}
      <div className={s.header}>
        <p className="eyebrow">Prompting</p>
        <h2 className={s.title}>Generador de prompts de imagen</h2>
        <p className={s.subtitle}>
          Selecciona uno de tus guiones recientes, analiza las escenas y genera prompts profesionales para Flux, Midjourney o GPT-Image.
        </p>
      </div>
```

Replace with:

```tsx
      {/* ── Header ── */}
      <div className={s.headerRow}>
        <div className={s.header}>
          <p className="eyebrow">Prompting</p>
          <h2 className={s.title}>Generador de prompts de imagen</h2>
          <p className={s.subtitle}>
            Selecciona uno de tus guiones recientes, analiza las escenas y genera prompts profesionales para Flux, Midjourney o GPT-Image.
          </p>
        </div>
        <Link href="/prompts/libre" className="btn btn-ghost" style={{ flexShrink: 0, marginTop: 8 }}>
          → Generación libre
        </Link>
      </div>
```

Also verify `Link` is already imported at the top of `PromptsClient.tsx`. If not, add:
```tsx
import Link from "next/link";
```

- [ ] **Step 3: Full build check**

```bash
cd "/Users/paco/Desktop/Claude Code/Contenido Redes/Guionizator Pro" && npm run build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` with zero TypeScript errors.

- [ ] **Step 4: Manual smoke test**

1. `npm run dev`
2. Go to `/prompts` — verify "→ Generación libre" button appears in the header.
3. Click it — lands on `/prompts/libre`.
4. Verify "← Desde guion" link works.
5. Select "Pixar 3D" style — pill highlights, description updates.
6. Leave textarea empty — "Generar prompt" button is disabled.
7. Type context: "Una empresaria joven caminando en una ciudad futurista de noche, lluvia, ambiente melancólico"
8. Click "✦ Generar prompt" — loading spinner appears, then result card shows.
9. Verify prompt is in English (monospace), description in Spanish below.
10. Click "Copiar prompt" — shows "¡Copiado!" for 2s, clipboard has the English prompt.
11. Click "↺ Regenerar" — new prompt generated for same context + style.
12. If user has custom styles, verify they appear as pills with "✦" icon.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/prompts/libre/page.tsx" "app/(app)/prompts/PromptsClient.tsx"
git commit -m "Feat: página /prompts/libre — generación libre de prompts de imagen"
```
