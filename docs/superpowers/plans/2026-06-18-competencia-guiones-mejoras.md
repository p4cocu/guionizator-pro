# Competencia + Guiones — Mejoras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar link de origen en guiones de adaptación, bote de basura y corazón de favorito en competencia, y auto-limpieza de posts viejos al ejecutar un scrape.

**Architecture:** Dos migraciones en Supabase (`source_post_permalink` en `scripts`, `is_favorite` en `competitor_posts`), ajustes a las server actions existentes y actualización de los componentes de cliente. El flujo de "adaptación completa" pasa el permalink como query param a `/guiones/nuevo`; la "adaptación ligera" lo guarda directamente al llamar `saveScriptWithNewIdea`. La auto-limpieza corre dentro de `runScrapeJob` en `lib/competencia/scrape.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (Postgres + RLS), CSS Modules.

## Global Constraints

- CSS puro en `*.module.css`, sin Tailwind ni estilos inline estructurales nuevos
- Todas las queries usan `owner_id` para RLS; nunca exponer service_role al cliente
- No añadir librerías nuevas
- Íconos de corazón y bote deben ser pequeños (~14px), sin ocupar espacio prominente
- Confirmación de borrado via `window.confirm` nativo (no modal custom)
- Posts sin `posted_at` no se borran en la auto-limpieza

---

## Task 1: Migraciones de base de datos

**Files:**
- No files — SQL ejecutado directamente en Supabase

**Interfaces:**
- Produce: columna `source_post_permalink text null` en tabla `scripts`
- Produce: columna `is_favorite boolean not null default false` en tabla `competitor_posts`

- [ ] **Step 1: Aplicar migración en Supabase**

Ejecutar este SQL en el SQL Editor de Supabase (o via MCP `execute_sql`):

```sql
-- Origen del guion (adaptaciones desde competencia)
ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS source_post_permalink text;

-- Favorito en posts de competencia
ALTER TABLE competitor_posts
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Verificar columnas**

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('scripts', 'competitor_posts')
  AND column_name IN ('source_post_permalink', 'is_favorite');
```

Resultado esperado: 2 filas — `source_post_permalink` (text, nullable), `is_favorite` (boolean, not null, default false).

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "feat: migraciones source_post_permalink + is_favorite"
```

---

## Task 2: Auto-limpieza de posts viejos al ejecutar scrape

**Files:**
- Modify: `lib/competencia/scrape.ts`

**Interfaces:**
- Consumes: función existente `runScrapeJob(supabase, scrapeId, apifyToken)`
- Produce: después del upsert de posts (paso 5), elimina posts con `posted_at < NOW() - 30 días` del mismo `(owner_id, client_id)`

- [ ] **Step 1: Agregar paso de limpieza en `runScrapeJob`**

En `lib/competencia/scrape.ts`, entre el bloque de upsert (paso 5, línea ~106) y el bloque de actualización de followers (paso 6, línea ~109), insertar:

```typescript
  // 5b. Limpiar posts con más de 30 días de publicados
  // Posts sin posted_at se ignoran (datos incompletos podrían ser recientes)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  await supabase
    .from("competitor_posts")
    .delete()
    .eq("owner_id", scrape.owner_id)
    .eq("client_id", scrape.client_id)
    .lt("posted_at", cutoff.toISOString())
    .not("posted_at", "is", null);
  // Error ignorado (best-effort): no fallamos el scrape por esto
```

El archivo completo del bloque afectado queda así (reemplazar desde `// 5.` hasta `// 6.`):

```typescript
  // 5. Guardar posts (upsert por (owner_id, client_id, shortcode))
  const now = new Date().toISOString();
  const rows = posts.map((p) => ({
    owner_id: scrape.owner_id,
    client_id: scrape.client_id,
    competitor_id: idByUsername.get(p.username) ?? null,
    scrape_id: scrapeId,
    username: p.username,
    shortcode: p.shortcode ?? extractShortcode(p.permalink),
    permalink: p.permalink ?? null,
    type: p.type,
    caption: p.caption ?? null,
    likes: p.likes,
    comments: p.comments,
    video_views: p.videoViews ?? null,
    followers: p.followers ?? null,
    posted_at: p.postedAt ?? null,
    scraped_at: now,
  }));

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("competitor_posts")
      .upsert(rows, { onConflict: "owner_id,client_id,shortcode" });
    if (insErr) return fail(insErr.message);
  }

  // 5b. Limpiar posts con más de 30 días de publicados
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  await supabase
    .from("competitor_posts")
    .delete()
    .eq("owner_id", scrape.owner_id)
    .eq("client_id", scrape.client_id)
    .lt("posted_at", cutoff.toISOString())
    .not("posted_at", "is", null);

  // 6. Actualizar followers de cada cuenta (best-effort)
```

- [ ] **Step 2: Verificar que TypeScript compila**

```bash
npm run build 2>&1 | head -40
```

Resultado esperado: sin errores de TypeScript en `lib/competencia/scrape.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/competencia/scrape.ts
git commit -m "feat: auto-limpieza de posts >30 días al ejecutar scrape"
```

---

## Task 3: Server actions de competencia — delete + favorite

**Files:**
- Modify: `app/(app)/competencia/actions.ts`

**Interfaces:**
- Modify type: `CompetitorPost` añade `is_favorite: boolean`
- Modify: `getLatestResults` — incluye `is_favorite` en SELECT
- Produce: `deleteCompetitorPost(postId: string): Promise<void>`
- Produce: `toggleFavoritePost(postId: string, value: boolean): Promise<void>`

- [ ] **Step 1: Actualizar el tipo `CompetitorPost`**

En `app/(app)/competencia/actions.ts`, localizar el tipo `CompetitorPost` (~línea 186) y añadir `is_favorite`:

```typescript
export type CompetitorPost = {
  id: string;
  username: string;
  permalink: string | null;
  type: string | null;
  caption: string | null;
  likes: number;
  comments: number;
  video_views: number | null;
  followers: number | null;
  posted_at: string | null;
  transcription: string | null;
  is_favorite: boolean;
};
```

- [ ] **Step 2: Actualizar el SELECT en `getLatestResults`**

En la función `getLatestResults` (~línea 225), añadir `is_favorite` al SELECT:

```typescript
  const { data: posts } = await supabase
    .from("competitor_posts")
    .select(
      "id, username, permalink, type, caption, likes, comments, video_views, followers, posted_at, transcription, is_favorite",
    )
    .eq("owner_id", user.id)
    .eq("client_id", clientId);
```

- [ ] **Step 3: Agregar `deleteCompetitorPost`**

Al final del archivo `app/(app)/competencia/actions.ts`:

```typescript
export async function deleteCompetitorPost(postId: string): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("competitor_posts")
    .delete()
    .eq("id", postId)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
}

export async function toggleFavoritePost(postId: string, value: boolean): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("competitor_posts")
    .update({ is_favorite: value })
    .eq("id", postId)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Verificar que TypeScript compila**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Resultado esperado: sin errores en `competencia/actions.ts`.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/competencia/actions.ts
git commit -m "feat: acciones deleteCompetitorPost + toggleFavoritePost"
```

---

## Task 4: UI de competencia — bote, corazón y filtro de favoritos

**Files:**
- Modify: `app/(app)/competencia/CompetenciaClient.tsx`
- Modify: `app/(app)/competencia/competencia.module.css`

**Interfaces:**
- Consumes: `deleteCompetitorPost`, `toggleFavoritePost` de `./actions`
- Consumes: `CompetitorPost.is_favorite: boolean`

- [ ] **Step 1: Importar las nuevas acciones en CompetenciaClient**

Al inicio de `app/(app)/competencia/CompetenciaClient.tsx`, añadir `deleteCompetitorPost` y `toggleFavoritePost` al import existente:

```typescript
import {
  addCompetitor,
  deleteCompetitorPost,
  getLatestResults,
  getScrapeStatus,
  listCompetitors,
  removeCompetitor,
  startScrape,
  toggleFavoritePost,
  type Competitor,
  type CompetitorPost,
} from "./actions";
```

- [ ] **Step 2: Agregar estado `onlyFavorites` y handlers**

Dentro del componente `CompetenciaClient`, después de la línea `const [transcribingId, setTranscribingId] = useState<string | null>(null);` (~línea 91), añadir:

```typescript
  const [onlyFavorites, setOnlyFavorites] = useState(false);
```

Después del handler `handleTranscribeClick`, añadir los dos nuevos handlers:

```typescript
  async function handleDeletePost(post: CompetitorPost) {
    if (!window.confirm("¿Eliminar este post de competencia? Esta acción no se puede deshacer.")) return;
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    await deleteCompetitorPost(post.id);
  }

  async function handleToggleFavorite(post: CompetitorPost) {
    const newValue = !post.is_favorite;
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, is_favorite: newValue } : p))
    );
    await toggleFavoritePost(post.id, newValue);
  }
```

- [ ] **Step 3: Aplicar filtro de favoritos en el `useMemo` de `sorted`**

Localizar el `useMemo` que genera `sorted` (~línea 142). Añadir el filtro de favoritos al inicio, después de `let list = posts.slice();`:

```typescript
  const sorted = useMemo(() => {
    let list = posts.slice();
    if (onlyFavorites) list = list.filter((p) => p.is_favorite);
    if (typeFilter !== "all") list = list.filter((p) => p.type === typeFilter);
    if (accountFilter !== "all") list = list.filter((p) => p.username === accountFilter);
    list.sort((a, b) => {
      switch (sortBy) {
        case "views":
          return (b.video_views ?? 0) - (a.video_views ?? 0);
        case "likes":
          return (b.likes ?? 0) - (a.likes ?? 0);
        case "comments":
          return (b.comments ?? 0) - (a.comments ?? 0);
        case "engagement":
          return eng(b) - eng(a);
        case "recent":
          return (
            new Date(b.posted_at ?? 0).getTime() - new Date(a.posted_at ?? 0).getTime()
          );
      }
    });
    return list;
  }, [posts, sortBy, typeFilter, accountFilter, onlyFavorites]);
```

- [ ] **Step 4: Agregar botón "Solo favoritos" en la barra de filtros**

En la sección de filtros (~línea 463), dentro del `<div className={s.filters}>`, añadir un nuevo grupo ANTES del grupo "Tipo":

```tsx
          <div className={s.filterGroup}>
            <button
              className={`${s.chipBtn} ${onlyFavorites ? s.chipBtnActive : ""}`}
              onClick={() => setOnlyFavorites((v) => !v)}
            >
              {onlyFavorites ? "♥ Favoritos" : "♡ Solo favoritos"}
            </button>
          </div>
```

- [ ] **Step 5: Agregar íconos de corazón y bote en cada postCard**

Localizar el bloque `<div className={s.postTop}>` (~línea 517) dentro del `sorted.map`. Añadir los dos botones icono DESPUÉS del span `isOutlier`:

```tsx
                  <div key={p.id} className={s.postCard}>
                    <div className={s.postTop}>
                      <span className={s.rank}>#{i + 1}</span>
                      <a
                        className={s.user}
                        href={`https://www.instagram.com/${p.username}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        @{p.username}
                      </a>
                      {isOutlier && (
                        <span className={s.outlier} title="Engagement vs su promedio">
                          🔥 {mult.toFixed(1)}×
                        </span>
                      )}
                      <span className={s.postActions}>
                        <button
                          className={s.iconBtn}
                          title={p.is_favorite ? "Quitar de favoritos" : "Marcar como favorito (transcribir luego)"}
                          onClick={() => handleToggleFavorite(p)}
                        >
                          {p.is_favorite ? "♥" : "♡"}
                        </button>
                        <button
                          className={`${s.iconBtn} ${s.iconBtnDelete}`}
                          title="Eliminar este post"
                          onClick={() => handleDeletePost(p)}
                        >
                          🗑
                        </button>
                      </span>
                    </div>
```

- [ ] **Step 6: Añadir estilos en competencia.module.css**

Al final de `app/(app)/competencia/competencia.module.css`:

```css
/* ── Íconos de post (corazón + bote) ── */
.postActions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.iconBtn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 3px 4px;
  border-radius: 4px;
  color: var(--text-dim);
  transition: color 0.15s, background 0.15s;
}

.iconBtn:hover {
  background: var(--surface-raised);
  color: var(--text);
}

.iconBtnDelete:hover {
  color: var(--flare);
}
```

- [ ] **Step 7: Verificar en el navegador**

```bash
npm run dev
```

Navegar a `/competencia`. Verificar:
- Cada card tiene ♡ y 🗑 a la derecha del @usuario
- Click en ♡ → se vuelve ♥ (favorito), persiste al recargar
- Click en 🗑 → `window.confirm` → al confirmar, la card desaparece
- Botón "♡ Solo favoritos" filtra la lista a posts marcados como favorito

- [ ] **Step 8: Commit**

```bash
git add app/\(app\)/competencia/CompetenciaClient.tsx app/\(app\)/competencia/competencia.module.css
git commit -m "feat: bote de basura, corazón de favorito y filtro en competencia"
```

---

## Task 5: Guiones actions — añadir source_post_permalink

**Files:**
- Modify: `app/(app)/guiones/actions.ts`

**Interfaces:**
- Modify type: `ScriptRow` añade `source_post_permalink: string | null`
- Modify: `saveScriptWithNewIdea(data)` — data incluye `source_post_permalink?: string | null`
- Modify: `saveScriptSilent(data)` — data incluye `source_post_permalink?: string | null`
- Modify: `saveScriptVersion` — propaga `source_post_permalink` de la versión padre

- [ ] **Step 1: Actualizar el tipo `ScriptRow`**

En `app/(app)/guiones/actions.ts`, localizar el tipo `ScriptRow` (~línea 19) y añadir el campo:

```typescript
export type ScriptRow = {
  id: string;
  client_id: string;
  type: ScriptType;
  brief: string;
  structure_name: string;
  title: string | null;
  content: Record<string, unknown>;
  brain_version_id: string | null;
  created_at: string;
  version_number: number;
  parent_id: string | null;
  is_latest: boolean;
  status: ScriptStatus;
  recording_type: RecordingType | null;
  source_post_permalink: string | null;
  clients: { nombre: string; marca: string | null } | null;
};
```

- [ ] **Step 2: Actualizar `saveScriptSilent`**

Localizar la función `saveScriptSilent` (~línea 78). Añadir `source_post_permalink` al parámetro y al insert:

```typescript
export async function saveScriptSilent(data: {
  client_id: string;
  type: ScriptType;
  brief: string;
  structure_name: string;
  title?: string | null;
  content: Record<string, unknown>;
  brain_version_id: string | null;
  source_post_permalink?: string | null;
}): Promise<string> {
  const { supabase, user } = await getAuthUser();

  const { data: script, error } = await supabase
    .from("scripts")
    .insert({
      owner_id: user.id,
      client_id: data.client_id,
      type: data.type,
      brief: data.brief,
      structure_name: data.structure_name,
      title: data.title ?? null,
      content: data.content,
      brain_version_id: data.brain_version_id,
      source_post_permalink: data.source_post_permalink ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/guiones");
  return script.id;
}
```

- [ ] **Step 3: Actualizar `saveScriptWithNewIdea`**

Localizar la función `saveScriptWithNewIdea` (~línea 115). Añadir `source_post_permalink` al parámetro y al insert:

```typescript
export async function saveScriptWithNewIdea(data: {
  client_id: string;
  type: ScriptType;
  brief: string;
  structure_name: string;
  title?: string | null;
  content: Record<string, unknown>;
  brain_version_id: string | null;
  source_post_permalink?: string | null;
}): Promise<string> {
  const { supabase, user } = await getAuthUser();

  const { data: script, error } = await supabase
    .from("scripts")
    .insert({
      owner_id: user.id,
      client_id: data.client_id,
      type: data.type,
      brief: data.brief,
      structure_name: data.structure_name,
      title: data.title ?? null,
      content: data.content,
      brain_version_id: data.brain_version_id,
      source_post_permalink: data.source_post_permalink ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: existing } = await supabase
    .from("content_calendar")
    .select("position")
    .eq("owner_id", user.id)
    .eq("month", month)
    .eq("year", year)
    .eq("week_number", 1)
    .order("position", { ascending: false })
    .limit(1);

  const maxPos = (existing?.[0]?.position ?? -1) as number;

  const { error: calError } = await supabase.from("content_calendar").insert({
    owner_id: user.id,
    client_id: data.client_id,
    script_id: script.id,
    title: data.title?.trim() || data.structure_name,
    format: data.type === "carousel" ? "carrusel" : "reel",
    platforms: ["instagram"],
    status: "idea",
    month,
    year,
    week_number: 1,
    position: maxPos + 1,
    brief: data.brief || null,
  });

  if (calError) throw new Error(calError.message);

  revalidatePath("/guiones");
  revalidatePath("/dashboard");
  return script.id;
}
```

- [ ] **Step 4: Propagar `source_post_permalink` en `saveScriptVersion`**

En la función `saveScriptVersion` (~línea 330), en el bloque `.insert({...})` de la nueva versión, añadir `source_post_permalink`:

```typescript
  const { data: newScript, error } = await supabase
    .from("scripts")
    .insert({
      owner_id: user.id,
      client_id: current.client_id,
      type: current.type,
      brief: current.brief,
      structure_name: current.structure_name,
      title: current.title ?? null,
      content,
      brain_version_id: current.brain_version_id,
      parent_id: rootId,
      version_number: nextVersion,
      is_latest: true,
      source_post_permalink: (current as ScriptRow).source_post_permalink ?? null,
    })
    .select("id")
    .single();
```

- [ ] **Step 5: Verificar que TypeScript compila**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Resultado esperado: sin errores en `guiones/actions.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/guiones/actions.ts
git commit -m "feat: source_post_permalink en ScriptRow y funciones de guardado"
```

---

## Task 6: Pasar permalink desde AdaptarModal y NuevoGuionForm

**Files:**
- Modify: `app/(app)/competencia/AdaptarModal.tsx`
- Modify: `app/(app)/guiones/nuevo/page.tsx`
- Modify: `app/(app)/guiones/nuevo/NuevoGuionForm.tsx`

**Interfaces:**
- Consumes: `saveScriptWithNewIdea` con `source_post_permalink?: string | null` (Task 5)
- `NuevoGuionForm` añade prop `initialSourcePostPermalink?: string`
- `NuevoGuionPage` lee `source_post_permalink` de `searchParams`

- [ ] **Step 1: Actualizar `AdaptarModal` — adaptación ligera**

En `app/(app)/competencia/AdaptarModal.tsx`, localizar la función `handleSave` (~línea 168). Añadir `source_post_permalink` al llamar `saveScriptWithNewIdea`:

```typescript
  function handleSave() {
    if (!data) return;
    startSave(async () => {
      try {
        const id = await saveScriptWithNewIdea({
          client_id: clientId,
          type: data.type,
          brief: buildBrief(post),
          structure_name: data.structure_name,
          title: title.trim() || null,
          content: data.content as Record<string, unknown>,
          brain_version_id: data.brain_version_id,
          source_post_permalink: post.permalink ?? null,
        });
        setSavedId(id);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }
```

- [ ] **Step 2: Actualizar `AdaptarModal` — adaptación completa**

En la función `handleContinuar` (~línea 124), cuando `adaptType === "completa"`, añadir `source_post_permalink` a los params de la URL:

```typescript
  function handleContinuar() {
    if (adaptType === "completa") {
      const brief = buildCompletaBrief(post);
      const type = post.type === "carousel" ? "carousel" : "reel";
      const params = new URLSearchParams({
        client_id: clientId,
        type,
        brief,
        ...(post.permalink ? { source_post_permalink: post.permalink } : {}),
      });
      router.push(`/guiones/nuevo?${params.toString()}`);
      onClose();
    } else {
      generate("ligera", adaptContext);
    }
  }
```

- [ ] **Step 3: Actualizar `NuevoGuionPage` para leer el nuevo param**

En `app/(app)/guiones/nuevo/page.tsx`, añadir `source_post_permalink` a `searchParams` y pasarlo al form:

```typescript
export default async function NuevoGuionPage({
  searchParams,
}: {
  searchParams: Promise<{ brief?: string; client_id?: string; calendar_id?: string; type?: string; source_post_permalink?: string }>;
}) {
  const { brief, client_id, calendar_id, type, source_post_permalink } = await searchParams;
  // ... resto igual ...
  return (
    // ...
    <NuevoGuionForm
      clientes={clientes}
      initialBrief={brief}
      initialClientId={client_id}
      initialCalendarId={calendar_id}
      initialType={type === "carousel" ? "carousel" : type === "reel" ? "reel" : undefined}
      initialSourcePostPermalink={source_post_permalink}
    />
  );
}
```

- [ ] **Step 4: Actualizar `NuevoGuionForm` para aceptar y usar el nuevo prop**

En `app/(app)/guiones/nuevo/NuevoGuionForm.tsx`:

**4a.** Añadir `initialSourcePostPermalink` a la firma del componente:

```typescript
export default function NuevoGuionForm({
  clientes,
  initialBrief,
  initialClientId,
  initialCalendarId,
  initialType,
  initialSourcePostPermalink,
}: {
  clientes: Cliente[];
  initialBrief?: string;
  initialClientId?: string;
  initialCalendarId?: string;
  initialType?: "reel" | "carousel";
  initialSourcePostPermalink?: string;
}) {
```

**4b.** En la función `handleSave` (~línea 570), añadir `source_post_permalink` al payload:

```typescript
  function handleSave(idx: number) {
    const g = generatedScripts[idx];
    startTransition(async () => {
      try {
        const payload = {
          client_id: clientId,
          type,
          brief,
          structure_name: g.structure.name,
          title: g.customTitle.trim() || null,
          content: g.content as Record<string, unknown>,
          brain_version_id: g.brainVersionId,
          source_post_permalink: initialSourcePostPermalink ?? null,
        };
        let id: string;
        if (initialCalendarId) {
          id = await saveScriptSilent(payload);
          await linkScriptToCalendar(id, initialCalendarId);
        } else {
          id = await saveScriptWithNewIdea(payload);
        }
        setGeneratedScripts((prev) =>
          prev.map((x, i) => (i === idx ? { ...x, savedId: id } : x))
        );
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }
```

- [ ] **Step 5: Verificar que TypeScript compila**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Resultado esperado: sin errores en los 3 archivos modificados.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/competencia/AdaptarModal.tsx app/\(app\)/guiones/nuevo/page.tsx app/\(app\)/guiones/nuevo/NuevoGuionForm.tsx
git commit -m "feat: pasar source_post_permalink desde AdaptarModal y NuevoGuionForm"
```

---

## Task 7: Mostrar link de origen en detalle del guion

**Files:**
- Modify: `app/(app)/guiones/[id]/ScriptDetailClient.tsx`
- Modify: `app/(app)/guiones/guiones.module.css`

**Interfaces:**
- Consumes: `ScriptRow.source_post_permalink: string | null` (Task 5)

- [ ] **Step 1: Añadir el bloque de origen en `ScriptDetailClient`**

En `app/(app)/guiones/[id]/ScriptDetailClient.tsx`, localizar el bloque `{/* ── Brief ── */}` (~línea 874). Después del bloque `<div className={styles.briefBox}>...</div>`, añadir:

```tsx
      {/* ── Post original (solo si es adaptación) ── */}
      {script.source_post_permalink && (
        <div className={styles.sourcePostBox}>
          <span className={styles.sourcePostLabel}>Post original</span>
          <a
            href={script.source_post_permalink}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sourcePostLink}
          >
            Ver en Instagram →
          </a>
        </div>
      )}
```

- [ ] **Step 2: Añadir estilos en guiones.module.css**

Al final de `app/(app)/guiones/guiones.module.css`:

```css
/* ── Link de post original (adaptaciones) ── */
.sourcePostBox {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--surface-raised);
  border-radius: 8px;
  margin-top: 8px;
}

.sourcePostLabel {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.sourcePostLink {
  font-size: 13px;
  color: var(--text-muted);
  text-decoration: none;
}

.sourcePostLink:hover {
  color: var(--emerald);
  text-decoration: underline;
}
```

- [ ] **Step 3: Verificar en el navegador**

```bash
npm run dev
```

1. Ir a `/competencia`, seleccionar un post y hacer click en "✦ Adaptar a mi marca"
2. Elegir **Adaptación ligera**, generar y guardar
3. Abrir el guion guardado en `/guiones/<id>`
4. Verificar que debajo del brief aparece `POST ORIGINAL  Ver en Instagram →` enlazando al post original
5. Abrir cualquier guion creado sin adaptación → el bloque NO debe aparecer

- [ ] **Step 4: Verificar adaptación completa**

1. En `/competencia`, click en "✦ Adaptar a mi marca" → elegir **Adaptación completa**
2. Se abre `/guiones/nuevo` con el brief y `source_post_permalink` en la URL
3. Completar el flujo de generación y guardar
4. Abrir el guion → verificar que aparece el link de origen

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/guiones/\[id\]/ScriptDetailClient.tsx app/\(app\)/guiones/guiones.module.css
git commit -m "feat: link de post original en detalle del guion (adaptaciones)"
```

---

## Verificación final

- [ ] Correr `npm run build` y confirmar salida limpia (0 errores TypeScript)
- [ ] Probar flujo completo: post de competencia → adaptación ligera → guion con link de origen visible
- [ ] Probar flujo completo: post de competencia → adaptación completa → guion con link de origen visible
- [ ] Verificar que ♥/♡ persiste en la BD (recargar página y comprobar estado)
- [ ] Verificar que el bote de basura elimina definitivamente (post no reaparece al recargar)
- [ ] Confirmar que guiones sin `source_post_permalink` no muestran el bloque de origen
