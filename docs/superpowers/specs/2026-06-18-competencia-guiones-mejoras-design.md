# Diseño: Mejoras Competencia + Guiones

**Fecha:** 2026-06-18  
**Estado:** Aprobado

## Resumen

Cuatro features pequeñas que conectan la sección de Competencia con Guiones:

1. Link de origen en guiones generados desde adaptaciones de competencia
2. Bote de basura para eliminar posts de competencia manualmente
3. Auto-limpieza de posts con más de 30 días al ejecutar un nuevo scrape
4. Corazón de favorito para marcar posts que requieren transcripción posterior

---

## Feature 1: Link de origen en guiones (adaptaciones)

### Problema
La tabla `scripts` no persiste de dónde vino una adaptación. El `brief` contiene el `@username` como texto pero no el permalink del post original.

### Solución

**DB:** Agregar columna `source_post_permalink text null` a la tabla `scripts`.

**Flujo adaptación ligera (AdaptarModal):**
- Al llamar `saveScriptWithNewIdea`, se pasa `source_post_permalink: post.permalink ?? null`
- `saveScriptWithNewIdea` acepta el campo y lo inserta en la fila

**Flujo adaptación completa (redirige a /guiones/nuevo):**
- La URL ya contiene `client_id`, `type` y `brief`; se agrega `source_post_permalink=<permalink>`
- `NuevoGuionForm` lee ese param del `searchParams` y lo pasa al action de guardado

**UI en ScriptDetailClient:**
- Debajo del bloque del brief, solo si `script.source_post_permalink` no es null:
  ```
  POST ORIGINAL  →  [link clickeable que abre Instagram en nueva pestaña]
  ```
- Estilo: `eyebrow` + link discreto con `color: var(--text-muted)`

### Archivos afectados
- `app/(app)/guiones/actions.ts` — añadir campo a `ScriptRow`, `saveScriptWithNewIdea`, `saveScriptSilent`
- `app/(app)/guiones/[id]/ScriptDetailClient.tsx` — mostrar bloque de origen
- `app/(app)/guiones/guiones.module.css` — estilos del bloque de origen
- `app/(app)/competencia/AdaptarModal.tsx` — pasar permalink al guardar
- `app/(app)/guiones/nuevo/NuevoGuionForm.tsx` — leer param y pasarlo al save

---

## Feature 2: Bote de basura (eliminar post de competencia)

### Solución

**Server action:** `deleteCompetitorPost(postId: string)` en `competencia/actions.ts`
- DELETE en `competitor_posts` filtrando por `id` y `owner_id` (seguridad RLS)
- No hace `revalidatePath` porque la UI se actualiza optimistamente

**UI en CompetenciaClient:**
- Ícono de bote (~14px) en la zona `postTop` de cada card, a la derecha del `@usuario`
- Click → `window.confirm("¿Eliminar este post de competencia? Esta acción no se puede deshacer.")` → si confirma: quitar del array `posts` en estado local + llamar action
- Estilos: botón ghost muy pequeño, sin borde, `color: var(--text-dim)`, hover `color: var(--flare)`

### Archivos afectados
- `app/(app)/competencia/actions.ts` — nueva action `deleteCompetitorPost`
- `app/(app)/competencia/CompetenciaClient.tsx` — handler + ícono en card
- `app/(app)/competencia/competencia.module.css` — clase `deletePostBtn`

---

## Feature 3: Auto-limpieza al ejecutar scrape

### Solución

En `lib/competencia/scrape.ts`, después del upsert de posts (paso 5, antes de actualizar followers), se agrega un paso de limpieza:

```sql
DELETE FROM competitor_posts
WHERE owner_id = <owner_id>
  AND client_id = <client_id>
  AND posted_at < NOW() - INTERVAL '30 days'
```

- Solo afecta al cliente del scrape en curso
- Posts sin `posted_at` (null) no se borran, para evitar eliminar datos incompletos
- Errores de esta operación son best-effort: se loguean pero no fallan el scrape

### Archivos afectados
- `lib/competencia/scrape.ts` — paso de limpieza entre upsert y actualización de followers

---

## Feature 4: Corazón de favorito

### DB
Columna `is_favorite boolean not null default false` en `competitor_posts`.

### Server action
`toggleFavoritePost(postId: string, value: boolean)` en `competencia/actions.ts`
- UPDATE `competitor_posts` SET `is_favorite = value` WHERE `id = postId AND owner_id = ...`

### UI en CompetenciaClient
- Ícono de corazón (~14px) en `postTop`, junto al bote
  - Favorito: `♥` en `color: var(--flare)` (rojo/señal)
  - No favorito: `♡` en `color: var(--text-dim)`
- Click → actualización optimista del array `posts` en estado local → llamar `toggleFavoritePost`
- **Filtro:** en la barra de filtros (junto a Ordenar / Tipo / Cuenta), un botón chipBtn `Solo favoritos` que filtra `sorted` por `is_favorite === true`

### Tipo actualizado
`CompetitorPost` añade `is_favorite: boolean`  
`getLatestResults` incluye `is_favorite` en el SELECT

### Archivos afectados
- `app/(app)/competencia/actions.ts` — tipo + nueva action + SELECT actualizado
- `app/(app)/competencia/CompetenciaClient.tsx` — ícono corazón, filtro, estado optimista

---

## Cambios en DB (migraciones)

```sql
-- 1. Origen del guion
ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS source_post_permalink text;

-- 2. Favorito en posts de competencia
ALTER TABLE competitor_posts
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
```

---

## Archivos afectados (lista completa)

| Archivo | Tipo de cambio |
|---------|----------------|
| `lib/competencia/scrape.ts` | Paso de limpieza de posts viejos |
| `app/(app)/competencia/actions.ts` | Tipo + 2 nuevas actions + SELECT |
| `app/(app)/competencia/CompetenciaClient.tsx` | Bote, corazón, filtro favoritos |
| `app/(app)/competencia/competencia.module.css` | Estilos iconos |
| `app/(app)/guiones/actions.ts` | `ScriptRow` + campo en saves |
| `app/(app)/guiones/[id]/ScriptDetailClient.tsx` | Bloque link de origen |
| `app/(app)/guiones/guiones.module.css` | Estilos bloque origen |
| `app/(app)/competencia/AdaptarModal.tsx` | Pasar permalink al guardar |
| `app/(app)/guiones/nuevo/NuevoGuionForm.tsx` | Leer param y pasarlo al save |

---

## Decisiones tomadas

- `window.confirm` nativo para confirmación de borrado (más simple, no necesita estado extra)
- Posts sin `posted_at` no se borran en la auto-limpieza (datos incompletos podrían ser recientes)
- Actualización optimista en favoritos y borrado (sin re-fetch, más rápido)
- Link de origen solo visible si `source_post_permalink` no es null (guiones anteriores no se ven afectados)
