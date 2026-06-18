# Carousel Image Prompts Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional "✦ Imágenes" panel to the carousel script detail page that generates AI image prompts per slide using the existing `/api/ai/prompt-image` endpoint, with style selected once and applied per slide on demand.

**Architecture:** New `ImagePromptsPanel` client component follows the exact same collapsible-panel pattern as `CopyExpertPanel`. It is wired into `ScriptDetailClient` (carousel-only button + conditional render). `page.tsx` fetches `customStyles` server-side and passes them down. No new API routes, no DB migrations.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, CSS Modules, existing `/api/ai/prompt-image` endpoint, existing `getPromptStyles()` server action.

## Global Constraints

- CSS Modules only — no Tailwind, no inline styles beyond minor overrides already present in the codebase.
- No new Supabase tables or migrations.
- No new npm dependencies.
- All text in Spanish latinoamericano (tuteo).
- Client component must be marked `"use client"`.
- No persistence — generate and copy only.
- Panel visible only when `script.type === "carousel"`.

---

### Task 1: CSS styles for the image prompts panel

**Files:**
- Modify: `app/(app)/guiones/guiones.module.css`

**Interfaces:**
- Produces: CSS class names used by `ImagePromptsPanel.tsx` in Task 2:
  - `.imagePanel` — outer wrapper
  - `.imagePanelHeader` — header row with title + close button
  - `.imagePanelTitle` — "✦ Prompts de imagen" heading
  - `.styleSelector` — horizontal scroll row of style pills
  - `.stylePill` — individual style pill (inactive)
  - `.stylePillActive` — selected style pill
  - `.slidePromptRow` — wrapper per slide
  - `.slidePromptMeta` — slide number + text title
  - `.slidePromptNum` — "Slide N" label
  - `.slidePromptTitle` — slide.text content
  - `.slidePromptVisual` — slide.visual description (dim text)
  - `.promptBox` — result box (monospace, selectable)
  - `.promptEn` — the English prompt text inside `.promptBox`
  - `.promptDesc` — `description_es` text below the box
  - `.promptActions` — row with copy button
  - `.promptError` — inline error state

- [ ] **Step 1: Append the image panel styles to `guiones.module.css`**

Add at the end of `app/(app)/guiones/guiones.module.css`:

```css
/* ── Image Prompts Panel ── */
.imagePanel {
  margin-top: 32px;
  border: 1px solid var(--border);
  border-radius: var(--r-card);
  background: var(--surface);
  padding: 24px;
}

.imagePanelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.imagePanelTitle {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.styleSelector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.stylePill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.stylePill:hover {
  border-color: var(--emerald);
  color: var(--emerald);
}

.stylePillActive {
  border-color: var(--emerald);
  background: rgba(0, 159, 125, 0.12);
  color: var(--emerald);
  font-weight: 600;
}

.slidePromptRow {
  padding: 16px 0;
  border-top: 1px solid var(--border);
}

.slidePromptRow:first-of-type {
  border-top: none;
  padding-top: 0;
}

.slidePromptMeta {
  margin-bottom: 8px;
}

.slidePromptNum {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.slidePromptTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 2px 0 4px;
}

.slidePromptVisual {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  margin: 0 0 10px;
}

.promptBox {
  background: var(--surface-2, rgba(255,255,255,0.04));
  border: 1px solid var(--border);
  border-radius: var(--r-sm, 8px);
  padding: 12px 14px;
  margin: 10px 0 6px;
}

.promptEn {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text);
  margin: 0 0 10px;
  user-select: all;
  word-break: break-word;
}

.promptDesc {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}

.promptActions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.promptError {
  font-size: 13px;
  color: var(--flare);
  margin: 8px 0 0;
}
```

- [ ] **Step 2: Verify the CSS file has no syntax errors**

Run:
```bash
npm run build 2>&1 | grep -i "css\|error" | head -20
```
Expected: no CSS errors (build may fail on TS — that's fine at this stage, CSS errors would appear here).

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/guiones/guiones.module.css"
git commit -m "Style: clases CSS para panel de prompts de imagen en carrusel"
```

---

### Task 2: ImagePromptsPanel component

**Files:**
- Create: `app/(app)/guiones/[id]/ImagePromptsPanel.tsx`

**Interfaces:**
- Consumes (from Task 1): CSS classes from `guiones.module.css` — `.imagePanel`, `.imagePanelHeader`, `.imagePanelTitle`, `.styleSelector`, `.stylePill`, `.stylePillActive`, `.slidePromptRow`, `.slidePromptMeta`, `.slidePromptNum`, `.slidePromptTitle`, `.slidePromptVisual`, `.promptBox`, `.promptEn`, `.promptDesc`, `.promptActions`, `.promptError`
- Consumes (from existing code):
  - `CarouselSlide` type from `../ScriptDetailClient` — `{ number: number; text: string; body?: string; visual: string; micro_anchor: string | null }`
  - `PromptStyle` type from `../../prompts/actions` — `{ id: string; name: string; description: string | null; style_type: string; base_style: string | null; style_tokens: string | null; ... }`
  - Endpoint `POST /api/ai/prompt-image` — body: `{ medium, subject, action, environment, style_vibe, technical_specs, base_style, style_tokens? }` → response: `{ prompt_en: string; description_es: string }`
- Produces: `export default function ImagePromptsPanel({ slides, customStyles, onClose }: Props)` — used by Task 3

- [ ] **Step 1: Create the file with types and constants**

Create `app/(app)/guiones/[id]/ImagePromptsPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { PromptStyle } from "../../prompts/actions";
import type { CarouselSlide } from "./ScriptDetailClient";
import styles from "../guiones.module.css";

const PRESET_STYLES = [
  {
    id: "realistic",
    name: "Hiperrealista",
    base_style: "realistic",
    style_tokens: null as string | null,
    icon: "📸",
  },
  {
    id: "pixar",
    name: "Pixar 3D",
    base_style: "pixar",
    style_tokens: null as string | null,
    icon: "🎬",
  },
  {
    id: "cinematic",
    name: "Cinemático",
    base_style: "cinematic",
    style_tokens: null as string | null,
    icon: "🎞",
  },
];

type SlideState = {
  loading: boolean;
  result: { prompt_en: string; description_es: string } | null;
  error: string | null;
  copied: boolean;
};

type Props = {
  slides: CarouselSlide[];
  customStyles: PromptStyle[];
  onClose: () => void;
};
```

- [ ] **Step 2: Add the component body**

Append to `ImagePromptsPanel.tsx`:

```tsx
export default function ImagePromptsPanel({ slides, customStyles, onClose }: Props) {
  const allStyles = [
    ...PRESET_STYLES,
    ...customStyles.map((s) => ({
      id: s.id,
      name: s.name,
      base_style: s.base_style ?? "custom",
      style_tokens: s.style_tokens,
      icon: "✨",
    })),
  ];

  const [selectedStyleId, setSelectedStyleId] = useState("realistic");
  const [slideStates, setSlideStates] = useState<Record<number, SlideState>>({});

  function getSlideState(num: number): SlideState {
    return slideStates[num] ?? { loading: false, result: null, error: null, copied: false };
  }

  function setSlideState(num: number, patch: Partial<SlideState>) {
    setSlideStates((prev) => ({
      ...prev,
      [num]: { ...getSlideState(num), ...patch },
    }));
  }

  async function handleGenerate(slide: CarouselSlide) {
    const selected = allStyles.find((s) => s.id === selectedStyleId);
    if (!selected) return;

    setSlideState(slide.number, { loading: true, error: null, result: null });

    try {
      const res = await fetch("/api/ai/prompt-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medium: "photography",
          subject: slide.text,
          action: "",
          environment: "relevant to the content",
          style_vibe: slide.visual,
          technical_specs: "9:16 vertical, Instagram carousel",
          base_style: selected.base_style,
          style_tokens: selected.style_tokens ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error generando prompt");
      setSlideState(slide.number, { loading: false, result: data });
    } catch (e) {
      setSlideState(slide.number, {
        loading: false,
        error: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }

  async function handleCopy(num: number, text: string) {
    await navigator.clipboard.writeText(text);
    setSlideState(num, { copied: true });
    setTimeout(() => setSlideState(num, { copied: false }), 2000);
  }

  return (
    <div className={styles.imagePanel}>
      {/* Header */}
      <div className={styles.imagePanelHeader}>
        <p className={styles.imagePanelTitle}>✦ Prompts de imagen</p>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: "4px 10px", fontSize: 12 }}>
          ✕ Cerrar
        </button>
      </div>

      {/* Style selector */}
      <div className={styles.styleSelector}>
        {allStyles.map((s) => (
          <button
            key={s.id}
            className={`${styles.stylePill} ${selectedStyleId === s.id ? styles.stylePillActive : ""}`}
            onClick={() => setSelectedStyleId(s.id)}
          >
            {s.icon} {s.name}
          </button>
        ))}
      </div>

      {/* Slide list */}
      {slides.map((slide) => {
        const state = getSlideState(slide.number);
        return (
          <div key={slide.number} className={styles.slidePromptRow}>
            <div className={styles.slidePromptMeta}>
              <p className={styles.slidePromptNum}>Slide {slide.number}</p>
              <p className={styles.slidePromptTitle}>{slide.text}</p>
              {slide.visual && (
                <p className={styles.slidePromptVisual}>{slide.visual}</p>
              )}
            </div>

            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: "5px 14px" }}
              onClick={() => handleGenerate(slide)}
              disabled={state.loading}
            >
              {state.loading ? "Generando…" : state.result ? "↺ Regenerar" : "✦ Generar prompt"}
            </button>

            {state.error && (
              <p className={styles.promptError}>{state.error}</p>
            )}

            {state.result && (
              <div className={styles.promptBox}>
                <p className={styles.promptEn}>{state.result.prompt_en}</p>
                <div className={styles.promptActions}>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: "4px 12px" }}
                    onClick={() => handleCopy(slide.number, state.result!.prompt_en)}
                  >
                    {state.copied ? "✓ Copiado" : "Copiar prompt"}
                  </button>
                </div>
                <p className={styles.promptDesc}>{state.result.description_es}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd "/Users/paco/Desktop/Claude Code/Contenido Redes/Guionizator Pro" && npm run build 2>&1 | tail -20
```
Expected: Build succeeds or any remaining errors are NOT in `ImagePromptsPanel.tsx`.

If there are type errors in `ImagePromptsPanel.tsx`, fix them before continuing.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/guiones/[id]/ImagePromptsPanel.tsx"
git commit -m "Feat: componente ImagePromptsPanel para carruseles"
```

---

### Task 3: Wire panel into page.tsx and ScriptDetailClient

**Files:**
- Modify: `app/(app)/guiones/[id]/page.tsx`
- Modify: `app/(app)/guiones/[id]/ScriptDetailClient.tsx`

**Interfaces:**
- Consumes (from Task 2): `ImagePromptsPanel` default export from `./ImagePromptsPanel`
- Consumes (existing): `getPromptStyles` from `../../prompts/actions` — returns `Promise<PromptStyle[]>`
- Consumes (existing): `PromptStyle` type from `../../prompts/actions`
- Consumes (existing): `CarouselContent` type from `ScriptDetailClient` — `{ slides: CarouselSlide[] }`

- [ ] **Step 1: Update `page.tsx` to fetch customStyles**

Replace the full content of `app/(app)/guiones/[id]/page.tsx` with:

```tsx
import { notFound } from "next/navigation";
import { getScriptWithVersions, getScriptCopies } from "../actions";
import { getPromptStyles } from "../../prompts/actions";
import ScriptDetailClient from "./ScriptDetailClient";

export default async function ScriptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, copies, customStyles] = await Promise.all([
    getScriptWithVersions(id),
    getScriptCopies(id),
    getPromptStyles(),
  ]);
  if (!result) notFound();

  return (
    <ScriptDetailClient
      script={result.script}
      versions={result.versions}
      initialCopies={copies}
      customStyles={customStyles}
    />
  );
}
```

- [ ] **Step 2: Add `customStyles` prop and `showImagePanel` state to ScriptDetailClient**

In `app/(app)/guiones/[id]/ScriptDetailClient.tsx`:

**2a.** Add imports at the top of the file (after the existing imports):

```tsx
import type { PromptStyle } from "../../prompts/actions";
import ImagePromptsPanel from "./ImagePromptsPanel";
```

**2b.** Update the `Props` type (find the existing type and replace it):

```tsx
type Props = {
  script: ScriptRow;
  versions: ScriptVersion[];
  initialCopies: ScriptCopy[];
  customStyles: PromptStyle[];
};
```

**2c.** Update the function signature to accept `customStyles`:

```tsx
export default function ScriptDetailClient({ script, versions, initialCopies, customStyles }: Props) {
```

**2d.** Add `showImagePanel` state alongside the other existing state declarations (after `const [showCopyPanel, setShowCopyPanel] = useState(false)`):

```tsx
const [showImagePanel, setShowImagePanel] = useState(false);
```

- [ ] **Step 3: Add the "✦ Imágenes" button in the action bar**

In `ScriptDetailClient.tsx`, find the action bar right section. The existing buttons end with the download menu. Add the Imágenes button **before** the download menu, visible only for carousels.

Find this block (inside `<div className={styles.actionBarRight}>`):

```tsx
          <Link
            href={`/prompts?script_id=${script.id}`}
            className="btn btn-ghost"
          >
            ✦ Prompting
          </Link>
```

Replace with:

```tsx
          <Link
            href={`/prompts?script_id=${script.id}`}
            className="btn btn-ghost"
          >
            ✦ Prompting
          </Link>

          {!isReel && (
            <button
              className={`btn btn-ghost ${showImagePanel ? "btn-secondary" : ""}`}
              onClick={() => setShowImagePanel((v) => !v)}
            >
              ✦ Imágenes
            </button>
          )}
```

- [ ] **Step 4: Render the ImagePromptsPanel below the carousel content**

In `ScriptDetailClient.tsx`, find the `{/* ── Copy Expert Panel ── */}` section and add the image panel render directly above it:

```tsx
      {/* ── Image Prompts Panel ── */}
      {showImagePanel && !isReel && (
        <ImagePromptsPanel
          slides={(content as CarouselContent).slides ?? []}
          customStyles={customStyles}
          onClose={() => setShowImagePanel(false)}
        />
      )}
```

- [ ] **Step 5: Verify the full build passes**

Run:
```bash
cd "/Users/paco/Desktop/Claude Code/Contenido Redes/Guionizator Pro" && npm run build 2>&1 | tail -30
```
Expected: `✓ Compiled successfully` with no TypeScript errors.

If errors appear, fix them before committing.

- [ ] **Step 6: Manual smoke test**

1. Run `npm run dev`
2. Open a carousel script in `/guiones/[id]`
3. Verify: "✦ Imágenes" button appears in the action bar
4. Open a Reel script — verify button does NOT appear
5. Click "✦ Imágenes" on a carousel — panel opens below the content
6. Select a style pill — it highlights correctly
7. Click "✦ Generar prompt" on any slide — loading state appears, then prompt appears
8. Click "Copiar prompt" — clipboard receives the English prompt, button shows "✓ Copiado" for 2s
9. Click "↺ Regenerar" — generates a new prompt for the same slide
10. Click "✕ Cerrar" — panel closes
11. Switching style does not clear already-generated prompts

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/guiones/[id]/page.tsx" "app/(app)/guiones/[id]/ScriptDetailClient.tsx"
git commit -m "Feat: panel de prompts de imagen para carruseles (✦ Imágenes)"
```
