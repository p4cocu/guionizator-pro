# Fases de mejoras — Guionizator Pro
> Generado: 2026-06-24  
> Referencia: conversación sobre nuevas funciones en guiones, recursos, dashboard y ganchos.

---

## INSTRUCCIÓN PARA CLAUDE AL INICIO DE CADA CHAT
Al abrir un nuevo chat, pega este prompt:
```
Continúa las mejoras de Guionizator Pro según /FASES_PENDIENTES.md.
La Fase 4 está completa. Empieza la Fase 5.
Ruta: /Users/paco/Desktop/Claude Code/Contenido Redes/Guionizator Pro
```

---

## Resumen rápido de decisiones ya tomadas
- El selector de estado ya guarda en BD automáticamente (no hay que cambiar eso).
- Copy Expert ya persiste en tabla `script_copies` (funciona hoy).
- Bug de títulos en Recursos: `getScriptsLite` filtra `is_latest = true`; si el guión tiene versiones nuevas, el ID vinculado en recursos apunta a versión antigua → no encuentra título. Fix: quitar el filtro `is_latest`.

---

## FASE 1 — Quick wins y fundamentos ✅ PENDIENTE

**Objetivo:** cambios de bajo riesgo, cero o mínimo cambio de esquema.

### 1a. Nuevo estado "preproducción"

**Archivos a tocar:**
- `app/(app)/guiones/actions.ts` → `ScriptStatus` type: agregar `"preproduccion"`
- `app/(app)/guiones/page.tsx` → `STATUS_LABELS`: agregar `preproduccion: "Preproducción"`
- `app/(app)/guiones/[id]/ScriptDetailClient.tsx` → `STATUS_OPTIONS`: agregar entrada con color verde claro pastel (`#b2f2bb` aprox)
- `app/(app)/guiones/ClientFilter.tsx` → opción en el selector de estado
- **Supabase:** el campo `status` en la tabla `scripts` usa `text`, no un enum estricto → no requiere migración.

### 1b. Bug: títulos de guiones vinculados en Recursos no aparecen

**Archivo:** `app/(app)/recursos/actions.ts` línea 84  
**Fix:** Quitar `.eq("is_latest", true)` de `getScriptsLite()` y subir límite a 500.  
El `find()` en el cliente busca por ID exacto, así que retornar todas las versiones sin filtro resuelve el problema.

### 1c. Bordes de tarjetas de guiones por estado

**Archivo:** `app/(app)/guiones/page.tsx` y `guiones.module.css`  
Agregar al card un `data-status` o clase dinámica por status, y en CSS:
- `idea` → borde por defecto (sin cambio)
- `preproduccion` → borde verde claro pastel (`rgba(178,242,187,0.5)`)
- `produccion` → borde dorado/amarillo (`rgba(255,210,58,0.5)`)
- `listo` → borde amarillo pastel (`rgba(255,235,150,0.5)`)
- `publicado` → borde verde (`rgba(0,159,125,0.5)`)

Los bordes son sutiles: `2px solid <color>` con opacidad baja.

**Nota:** El borde dorado por "recurso vinculado" va en Fase 2 (requiere join cross-tabla).

---

**Prompt para continuar en chat nuevo al terminar Fase 1:**
```
Continúa las mejoras de Guionizator Pro según /FASES_PENDIENTES.md.
La Fase 1 está completa. Empieza la Fase 2.
Ruta: /Users/paco/Desktop/Claude Code/Contenido Redes/Guionizator Pro
```

---

## FASE 2 — Filtros, recursos propios en guiones y borde vinculado ✅ PENDIENTE

### 2a. Filtro multi-estado con checkboxes en Guiones

**Archivo:** `app/(app)/guiones/ClientFilter.tsx`  
Reemplazar el `<select>` de estado por pills/checkboxes: mostrar todos los estados y que el usuario seleccione cuáles ver.  
- La URL lleva múltiples valores: `?estado=idea&estado=listo`
- `getScripts` en actions.ts: cuando hay múltiples estados, usar `.in("status", estados[])`
- Eliminar los combos hardcodeados (`activos`, `ideas_listo`, etc.) — ya no son necesarios

**UX:** pills horizontales, cada una toggleable, activas resaltadas con color del estado.

### 2b. Link/sección de recurso propio en ficha de guión

**Archivo:** `app/(app)/guiones/[id]/ScriptDetailClient.tsx` y `page.tsx`  

No requiere nueva columna en `scripts`. Approach: en `getScriptWithVersions` o en la página del guión, hacer un query adicional:
```sql
SELECT id, title, drive_url, keyword_trigger 
FROM own_resources 
WHERE script_id = $scriptId AND owner_id = $userId
```
Si existe → mostrar un bloque en la ficha con el enlace a Drive y la keyword.  
Si no existe → mostrar botón/link "Vincular recurso propio" que lleva a `/recursos?tab=propios`.

**Esto es solo lectura + navegación** — la vinculación ya se hace desde Recursos.

### 2c. Borde dorado cuando el guión tiene recurso vinculado

**Archivo:** `app/(app)/guiones/actions.ts` (función `getScripts`)  
Agregar un subquery o join para detectar si existe algún recurso (resources o own_resources) con ese `script_id`:
```sql
SELECT s.*, 
  EXISTS(SELECT 1 FROM resources r WHERE r.script_id = s.id) OR
  EXISTS(SELECT 1 FROM own_resources o WHERE o.script_id = s.id) AS has_resource
FROM scripts s ...
```
Pasar `has_resource` en `ScriptRow` y en `ScriptCard` agregar clase/borde dorado (`rgba(255,215,0,0.6)`) cuando es true.

---

**Prompt para continuar en chat nuevo al terminar Fase 2:**
```
Continúa las mejoras de Guionizator Pro según /FASES_PENDIENTES.md.
La Fase 2 está completa. Empieza la Fase 3.
Ruta: /Users/paco/Desktop/Claude Code/Contenido Redes/Guionizator Pro
```

---

## FASE 3 — Múltiples ganchos por guión ✅ PENDIENTE

### Contexto
El baúl de ganchos (`/ganchos`) tiene una tabla con hooks. Cada guión podrá tener N hooks asociados para grabar múltiples versiones y A/B testear cuál funciona mejor.

### 3a. Migración de BD: tabla `script_hooks`

```sql
CREATE TABLE script_hooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users NOT NULL,
  script_id uuid REFERENCES scripts(id) ON DELETE CASCADE NOT NULL,
  hook_text text NOT NULL,
  hook_id uuid REFERENCES hooks(id) ON DELETE SET NULL, -- nullable: hook del baúl o texto libre
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE script_hooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner only" ON script_hooks 
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
```

Aplicar en Supabase con `apply_migration`.

### 3b. UI en ficha de guión — Panel de ganchos

En `ScriptDetailClient.tsx`, agregar una sección "Ganchos" debajo del brief:
- Listado de hooks ya agregados (editables, reordenables)
- Botón "Sugerir ganchos" → llama a endpoint IA que revisa el contenido del guión y los hooks del baúl y recomienda los más relevantes (basándose en categoría, tema, cliente)
- Botón "Seleccionar del baúl" → dropdown/modal con los hooks del baúl para elegir manualmente
- Input para gancho libre (texto propio sin baúl)

### 3c. Actions para script_hooks

Nuevo archivo: `app/(app)/guiones/[id]/hooksActions.ts`
- `getScriptHooks(scriptId)` → lista de hooks del guión
- `addScriptHook(scriptId, hookText, hookId?)` → inserta
- `removeScriptHook(id)` → elimina
- `reorderScriptHooks(ids[])` → actualiza position

### 3d. Endpoint IA para sugerencia de ganchos

`app/api/ai/suggest-hooks/route.ts`  
Input: `script_id`, `script_content` (voice_off o slides), lista de hooks del baúl  
Output: array de hasta 5 hooks recomendados con `id` y `razon`

---

**Prompt para continuar en chat nuevo al terminar Fase 3:**
```
Continúa las mejoras de Guionizator Pro según /FASES_PENDIENTES.md.
La Fase 3 está completa. Empieza la Fase 4.
Ruta: /Users/paco/Desktop/Claude Code/Contenido Redes/Guionizator Pro
```

---

## FASE 4 — Dashboard → Calendario con vista real ✅ PENDIENTE

### Contexto
La pestaña "Dashboard" hoy es un tablero de publicaciones (content_calendar). Se renombra a "Calendario" y se añade una vista de calendario mensual real con drag-and-drop.

### 4a. Renombrar Dashboard → Calendario

- `components/Sidebar.tsx` → cambiar `{ href: "/dashboard", label: "Dashboard" }` a `label: "Calendario"`
- `app/(app)/dashboard/page.tsx` y `DashboardClient.tsx` → actualizar títulos y metadata
- Verificar que rutas y links internos que usan `/dashboard` sigan funcionando (no cambia la ruta, solo el label)

### 4b. Vista de calendario mensual

En `DashboardClient.tsx`:
- Agregar tab toggle: "Vista kanban (semanas)" / "Vista calendario"
- En vista calendario: renderizar un grid mensual real con días 1–31
- Cada entrada de `content_calendar` con `scheduled_date` se muestra en su día
- Entradas sin fecha van a una zona "Sin fecha" al lado

**Requiere:** agregar columna `scheduled_date date` a `content_calendar` si no existe (verificar en Supabase antes de migrar).

### 4c. Drag-and-drop entre fechas

Usar la API nativa HTML5 drag-and-drop (sin librerías externas):
- Al arrastrar una tarjeta a otro día → llama a `updateCalendarDate(id, newDate)`
- `updateCalendarDate` en actions: `UPDATE content_calendar SET scheduled_date = $date WHERE id = $id`
- Actualización optimista en el cliente

---

**Prompt para continuar en chat nuevo al terminar Fase 4:**
```
Continúa las mejoras de Guionizator Pro según /FASES_PENDIENTES.md.
La Fase 4 está completa. Empieza la Fase 5.
Ruta: /Users/paco/Desktop/Claude Code/Contenido Redes/Guionizator Pro
```

---

## FASE 5 — Nueva pestaña Dashboard de métricas ✅ PENDIENTE

### Contexto
Se crea una nueva ruta `/dashboard` (la antigua ahora es `/calendario`) dedicada exclusivamente a métricas.

### 5a. Ajuste de rutas y sidebar

- Renombrar directorio `app/(app)/dashboard/` → `app/(app)/calendario/`
- Crear nuevo `app/(app)/dashboard/` para la página de métricas
- Sidebar: agregar `{ href: "/dashboard", label: "Dashboard" }` arriba de "Calendario"

### 5b. Métricas propuestas (a implementar)

**Guiones:**
- Total por estado (idea / preproducción / producción / listo / publicado)
- Velocidad: guiones creados últimos 30 días vs. mes anterior
- Tasa de publicación: publicados / total (%)
- Guiones por cliente (top 5)
- Guiones con recurso vinculado vs. sin recurso

**Ganchos (si Fase 3 está completa):**
- Top hooks más usados en guiones

**Instagram (si cuenta conectada):**
- Resumen rápido: seguidores, alcance promedio, engagement rate últimos 7 días
- Top 3 posts del mes por alcance

**Actividad:**
- Últimos 7 días: guiones creados, estados cambiados a publicado

### 5c. Implementación

- Server component con múltiples queries paralelas a Supabase
- Componentes de métrica simples: número grande + tendencia + mini-barra
- Sin librerías de gráficas externas por ahora (solo CSS puro con barras `div`)

---

**Prompt al terminar todas las fases:**
```
Todas las fases de FASES_PENDIENTES.md están completas.
Hacer un repaso final de Guionizator Pro para verificar consistencia.
Ruta: /Users/paco/Desktop/Claude Code/Contenido Redes/Guionizator Pro
```

---

## Estado de fases

| Fase | Nombre | Estado |
|------|--------|--------|
| 1 | Quick wins (preproducción, bug recursos, bordes) | ✅ Completa |
| 2 | Filtros, recursos en guiones, borde vinculado | ✅ Completa |
| 3 | Múltiples ganchos por guión | ✅ Completa |
| 4 | Dashboard → Calendario con drag-and-drop | ✅ Completa |
| 5 | Nuevo Dashboard de métricas | ✅ Completa |
