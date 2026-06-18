# Generación Libre de Prompts — Design Spec
_2026-06-18_

## Goal

Add a dedicated `/prompts/libre` page where the user writes free-form context describing what they want to visualize, selects a visual style, and gets a professional AI image prompt immediately — no scene analysis, no script selection, no clarifying questions.

## Constraints

- Separate route from `/prompts` (option C) — no changes to existing PromptsClient or its API.
- No persistence — generate and copy only.
- Reuses existing `/api/ai/prompt-image` endpoint unchanged.
- Reuses existing `getPromptStyles()` server action to load custom styles.
- CSS Modules only (no Tailwind). Reuses existing class names from `prompts.module.css` where possible; new classes added to that same file.
- No new Supabase tables, migrations, or API routes.
- No new npm dependencies.
- Text in Spanish latinoamericano (tuteo).

## Architecture

New route `app/(app)/prompts/libre/` with a server `page.tsx` that fetches custom styles and renders `LibreClient.tsx` (client component). The only connection to the existing `/prompts` page is a cross-link in each page's header. No shared state between the two pages.

## Pages & Files

| File | Role |
|------|------|
| `app/(app)/prompts/libre/page.tsx` | Server component — fetches `customStyles` via `getPromptStyles()`, renders `LibreClient` |
| `app/(app)/prompts/libre/LibreClient.tsx` | Client component — full UI: style selector, context textarea, generate button, result display |
| `app/(app)/prompts/PromptsClient.tsx` | Minor edit — add "→ Generación libre" link in header |
| `app/(app)/prompts/prompts.module.css` | Add new classes for the libre page (form card, result card) |

## UI Layout

```
EYEBROW: Prompting
H2: Generación libre de prompts
Subtitle + link "← Desde guion"

[card: Estilo visual]
  Pill buttons: 📸 Hiperrealista · 🎬 Pixar 3D · 🎞 Cinemático · ✦ custom styles…
  Description of selected style below

[card: Contexto]
  <label> Describe lo que querés visualizar </label>
  <textarea placeholder="Personaje, escenario, acción, ambiente, mood…">
  [✦ Generar prompt]  — disabled when loading or context is empty

[card: Resultado — only shown after successful generation]
  <p monospace, user-select:all> prompt_en </p>
  [Copiar prompt]  [↺ Regenerar]
  <p muted> description_es </p>

  Error state (inline, no card): error message in var(--flare)
```

## API Mapping

Calls `POST /api/ai/prompt-image` with:

```ts
{
  medium: "",
  subject: context,        // the full textarea value
  action: "",
  environment: "",
  style_vibe: "",
  technical_specs: "9:16 vertical, Instagram",
  base_style: selected.base_style,          // "realistic" | "pixar" | "cinematic" | "custom"
  style_tokens: selected.style_tokens ?? undefined,
}
```

Response: `{ prompt_en: string; description_es: string }`

## Client State

```ts
selectedStyleId: string   // default "realistic"
context: string           // textarea value
loading: boolean          // true while fetch in-flight
result: { prompt_en: string; description_es: string } | null
error: string | null
copied: boolean           // resets after 2s
```

"Regenerar" re-fires the same fetch with unchanged context + style. Changing style or context does not clear a previous result — user must click Generar/Regenerar explicitly.

## Preset Styles Constant

Same `PRESET_STYLES` array as in `PromptsClient.tsx`:
```ts
const PRESET_STYLES = [
  { id: "realistic", name: "Hiperrealista", base_style: "realistic", style_tokens: null, icon: "📸" },
  { id: "pixar",     name: "Pixar 3D",      base_style: "pixar",     style_tokens: null, icon: "🎬" },
  { id: "cinematic", name: "Cinemático",     base_style: "cinematic", style_tokens: null, icon: "🎞" },
]
```
Custom styles appended from `customStyles` prop with icon "✦".

## Cross-linking

- `PromptsClient.tsx` header: add `<Link href="/prompts/libre">→ Generación libre</Link>` as a `btn btn-ghost` next to the title.
- `LibreClient.tsx` header: `<Link href="/prompts">← Desde guion</Link>` as a `btn btn-ghost`.
