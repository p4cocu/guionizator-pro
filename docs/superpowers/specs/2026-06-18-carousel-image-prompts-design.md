# Carousel Image Prompts Panel — Design Spec
_2026-06-18_

## Goal

Add an optional "✦ Imágenes" panel to the carousel script detail page that lets the user generate AI image prompts (for Flux, Midjourney, GPT-Image, etc.) per slide. Style is chosen once for the whole carousel; each slide is generated independently on demand.

## Constraints

- Carousel only (not Reels).
- No persistence — generate and copy, no Supabase writes.
- Uses existing `/api/ai/prompt-image` endpoint unchanged.
- Existing preset styles (realistic, pixar, cinematic) + user's custom styles from `prompt_styles` table.

## Architecture

### New file

`app/(app)/guiones/[id]/ImagePromptsPanel.tsx` — client component, mirrors the pattern of `CopyExpertPanel.tsx`.

### Changes to existing files

**`app/(app)/guiones/[id]/page.tsx` (server)**
- Import `getPromptStyles` from `/prompts/actions`.
- Fetch custom styles alongside script data: `const customStyles = await getPromptStyles()`.
- Pass `customStyles` as prop to `ScriptDetailClient`.

**`app/(app)/guiones/[id]/ScriptDetailClient.tsx`**
- Accept `customStyles: PromptStyle[]` prop.
- Add `showImagePanel` state (boolean, default false).
- Add "✦ Imágenes" button in action bar, visible only when `!isReel`.
- Render `<ImagePromptsPanel>` below carousel content when `showImagePanel && !isReel`.

## ImagePromptsPanel component

### Props
```ts
type Props = {
  slides: CarouselSlide[];
  customStyles: PromptStyle[];
};
```

### State
```ts
// Selected style
selectedStyleId: string  // default "realistic"

// Per-slide generation state, keyed by slide.number
slideStates: Record<number, {
  loading: boolean;
  result: { prompt_en: string; description_es: string } | null;
  error: string | null;
  copied: boolean;
}>
```

### Style selector

Renders preset styles (realistic, pixar, cinematic) + user's custom styles as pill buttons. Same `PRESET_STYLES` array as in `PromptsClient.tsx`.

### Slide list

Each slide renders:
- Slide number + `slide.text` as title
- `slide.visual` as subtitle (the guion's visual description, used as context)
- "✦ Generar prompt" button → calls `/api/ai/prompt-image`
- While loading: "Generando…" disabled state
- On result: prompt box (monospace, selectable) + "Copiar" button (copies `prompt_en`) + `description_es` in small text below
- On error: inline error message + retry option

### API call mapping

```
slide.text   → subject
slide.visual → style_vibe
medium       → "photography" (default)
action       → "" (empty)
environment  → "relevant to the content"
technical_specs → "9:16 vertical, Instagram carousel"
base_style   → selectedStyleId (or "custom" for custom styles)
style_tokens → style.style_tokens (only for custom styles)
```

### Style resolution

```ts
const allStyles = [...PRESET_STYLES, ...customStyles]
const selected = allStyles.find(s => s.id === selectedStyleId)
const base_style = selected?.base_style ?? "realistic"
const style_tokens = selected?.style_tokens ?? undefined
```

## UX details

- Panel header: "✦ Prompts de imagen" with a close "✕" button (sets `showImagePanel = false`).
- Changing the selected style does NOT clear already-generated prompts (user can regenerate manually).
- "Copiar" shows "✓ Copiado" for 2s then resets.
- Panel is not sticky — it renders inline below the carousel viewer, same as Copy Expert.

## Files touched

| File | Change |
|------|--------|
| `app/(app)/guiones/[id]/ImagePromptsPanel.tsx` | New component |
| `app/(app)/guiones/[id]/ScriptDetailClient.tsx` | Add button + panel render + customStyles prop |
| `app/(app)/guiones/[id]/page.tsx` | Fetch customStyles, pass to ScriptDetailClient |
| `app/(app)/guiones/guiones.module.css` | Add panel styles (reusing existing patterns) |

No new API routes, no DB migrations, no new dependencies.
