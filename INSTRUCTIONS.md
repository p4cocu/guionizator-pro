# Guionizator Pro — Guía de Operación

App en producción: **guionizator.pacocuevasia.com**  
Dev local: **localhost:3000**

---

## Arrancar en local

```bash
npm run dev
```

Siempre accede por `localhost:3000` cuando necesites funciones que solo corren en tu Mac
(transcripción con Whisper). Para todo lo demás puedes usar la URL de producción.

---

## Sección Competencia

### Cómo funciona

1. Selecciona el cliente en el selector superior
2. Agrega cuentas de competencia con `@usuario` → **Agregar**
3. Elige cuántos posts traer y (opcionalmente) una fecha mínima
4. Click **Ejecutar búsqueda**
   - En local: corre síncrono, espera ~10–30s
   - En producción: corre en background (Netlify Function), la UI hace polling cada 4s
5. Los resultados se acumulan en Supabase — re-scrapear actualiza métricas de posts repetidos y agrega nuevos sin perder lo anterior

### Cuántos posts pedir

| Situación | Recomendación |
|-----------|--------------|
| Primera vez con una cuenta | 30–50 |
| Actualizar métricas (base <72h) | 5 (recomendado automáticamente) |
| Búsqueda normal | 10–15 |

### Filtros y orden

Los filtros (tipo, cuenta) y el orden (vistas, engagement, likes, recientes) se aplican
en el cliente sin volver a buscar. El badge 🔥 indica posts con engagement ×1.5 o más
sobre el promedio de esa cuenta.

---

## Transcripción local de Reels (solo en tu Mac)

Convierte el audio de un Reel de competencia en texto con Whisper (local, sin API externa)
y lo guarda en Supabase para usarlo desde cualquier dispositivo.

### Requisitos (ya instalados)

```bash
pip3 install faster-whisper yt-dlp
# faster-whisper 1.2.1 ✓
# yt-dlp 2026.3.17 ✓
```

### Flujo paso a paso

1. Abre este proyecto y corre `npm run dev`
2. Abre `localhost:3000` en el browser (no la URL de producción)
3. Ve a **Competencia** y selecciona el cliente
4. En cualquier post card (Reels y carruseles), verás la fila:
   - `Sin transcripción` + botón **🎤 Transcribir**
   - Al terminar: `● Transcripción lista` + botón **Re-transcribir**
5. Click **🎤 Transcribir** — tarda ~30–90s según la duración del Reel
6. La transcripción se guarda en Supabase automáticamente

### Desde iPad o cualquier otro dispositivo

Una vez transcrito desde el Mac, el dato está en Supabase. Al abrir
`guionizator.pacocuevasia.com` desde iPad y hacer click en **Adaptar a mi marca**:

- El modal muestra un badge verde: **"Transcripción disponible"**
- Claude recibe el texto del audio como fuente primaria (no solo el caption)
- El guion generado refleja lo que el competidor realmente dijo, no solo su descripción

### Modelos de Whisper disponibles

El script usa `small` por defecto (rápido, ~85% precisión). Si el audio tiene ruido
o acento difícil, edita `scripts/transcribe_reel.py` y cambia `DEFAULT_MODEL`:

| Modelo | Velocidad | Precisión | Ideal para |
|--------|-----------|-----------|-----------|
| `small` | Rápido | ~85% | Reels normales (default) |
| `medium` | Medio | ~90% | Audio ruidoso, acentos fuertes |
| `large-v3` | Lento | ~95% | Máxima precisión |

---

## Adaptar a mi marca

Desde cualquier post card → **✦ Adaptar a mi marca**:

**Adaptación completa** — toma el ángulo y gancho ganadores y te lleva al flujo de
generación completo (`/guiones/nuevo`) con control total: brief, estructura, edición.

**Adaptación ligera** — conserva la misma idea pero adapta el tono de voz al estilo del
cliente. Resultado directo en el modal, editable y guardable como guion.

Si el post tiene transcripción, Claude usa el audio como fuente primaria en ambos modos.

---

## Variables de entorno

### `.env.local` (solo tu Mac, nunca se sube al repo)

| Variable | Para qué |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase |
| `ANTHROPIC_API_KEY` | Claude (solo server-side) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` en local |
| `APIFY_API_TOKEN` | Scraping de competencia |
| `NEXT_PUBLIC_TRANSCRIBE_ENABLED` | `true` → muestra el botón de transcripción |

### Variables en Netlify (producción)

| Variable | Para qué |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Igual que local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Igual que local |
| `ANTHROPIC_API_KEY` | Claude |
| `NEXT_PUBLIC_SITE_URL` | `https://guionizator.pacocuevasia.com` |
| `APIFY_API_TOKEN` | Scraping de competencia |
| `SUPABASE_SERVICE_ROLE_KEY` | Para la Background Function de scraping |
| `SCRAPE_FN_SECRET` | Token secreto para activar la Background Function |
| ~~`NEXT_PUBLIC_TRANSCRIBE_ENABLED`~~ | No poner aquí — la transcripción solo funciona en Mac |

---

## Deploy a producción

⚠️ **Desde 2026-07-16 los builds automáticos de Netlify están PAUSADOS** (`stop_builds: true`,
badge "Builds are stopped" visible en el dashboard). Un `git push` a `main` **ya NO dispara
un deploy**. Se hace manual con el CLI de Netlify para no gastar build minutes/créditos:

```bash
git add .
git commit -m "descripción del cambio"
git push                              # opcional, solo respalda el código en GitHub

netlify build && netlify deploy --prod
```

- `netlify build` corre el build **en tu Mac** (no en los runners de Netlify) y ejecuta el
  plugin `@netlify/plugin-nextjs`, que genera las Functions necesarias para SSR, las API
  routes, el middleware de auth (`proxy.ts`) y la Scheduled Function de limpieza.
- `netlify deploy --prod` (sin `--build`) sube ese resultado ya construido — no dispara
  build remoto.
- El repo (`p4cocu/guionizator-pro`) sigue conectado en Netlify vía GitHub, pero solo para
  referencia/vínculo — no para auto-deploy.
- Site ID: `206f4da1-f18e-468b-a2d2-ff41b5e92fff`. Requiere `netlify link` una sola vez por
  máquina nueva (ya vinculado en este Mac).

**Reactivar auto-deploy** (si algún día se quiere volver atrás):
Netlify → Site settings → Build & deploy → Continuous deployment → reanudar builds.
O vía API: `netlify api updateSite --data '{"site_id":"206f4da1-f18e-468b-a2d2-ff41b5e92fff","body":{"build_settings":{"stop_builds":false}}}'`

---

## Comandos útiles

```bash
npm run dev      # servidor de desarrollo (localhost:3000)
npm run build    # build de producción (verificar que no haya errores antes de push)
npm run lint     # linter TypeScript
```
