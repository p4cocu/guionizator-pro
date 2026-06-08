# CLAUDE.md — Guionizator Pro

App web que convierte el prompt "ROL — Guionista" en una herramienta para crear
guiones de **Instagram** (Reels 30–60s y carruseles) por **cliente**, con un
"cerebro" editable, edición por IA y edición manual, persistencia y mejora continua.
Vive en `guionizator.pacocuevasia.com`.

> Plan maestro por fases: `/Users/paco/.claude/plans/rol-guionista-especialista-ticklish-canyon.md`

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript.**
- **CSS puro + CSS Modules** (sin Tailwind), tokens de marca Paco Cuevas en `app/globals.css`.
- **Supabase** (Postgres + Auth + RLS) vía `@supabase/ssr`.
- **Anthropic (Claude)** server-side con prompt caching (Fase 1+).
- **Deploy: Netlify** (`@netlify/plugin-nextjs`).

## Decisiones de arquitectura

- **Multi-tenant desde el día 1.** Solo Paco usa hoy, pero se venderá como SaaS.
  Toda tabla de datos lleva `owner_id` (→ `auth.users`) + **RLS** por `auth.uid()`.
- IA = **Claude** (no OpenAI). Key solo server-side, nunca `NEXT_PUBLIC`.
- El prompt ROL es el **"cerebro"**: editable y versionado (Fase 1) — el claude.md de la app.
- Idioma del producto: **español latinoamericano**, tuteo.

## Convenciones

- Tokens y estética: derivados de `paco diseno.md` (paleta verde ink/forest/emerald
  + signal amarillo; Space Grotesk display + DM Sans body; glass cards; grid blueprint).
  Es **UI de producto** (sidebar + editor), no landing — se toman tokens y voz, no el layout de secciones.
- Clases utilitarias globales en `globals.css`: `.card`, `.btn` (`.btn-primary/secondary/ghost`),
  `.input/.textarea/.field-label`, `.badge`, `.eyebrow`, `.text-grad`, `.blueprint`, `.rule-yellow`.
- Estilos por componente/página en `*.module.css` colocados junto al archivo.
- Supabase: `lib/supabase/{client,server,middleware}.ts`. Nunca exponer `service_role`.
  Para auth en server: `getUser()` (no confiar solo en `getSession()`).
- Knowledge base de guiones en `knowledge/` (se copiará a `brain/` en Fase 1).

## Estructura de carpetas

```
app/
  layout.tsx            # fuentes de marca + metadata
  globals.css           # tokens + utilitarios
  page.tsx              # redirect a /dashboard
  login/                # login/signup (client) + auth/callback
  (app)/                # grupo protegido: layout con Sidebar + Topbar
    dashboard/  clientes/  guiones/  cerebro/
components/             # Sidebar, Topbar, LogoutButton, Placeholder
lib/supabase/           # clients server/browser + middleware de sesión
middleware.ts           # refresca sesión + protege rutas privadas
knowledge/              # base de conocimiento de guiones
```

## Variables de entorno (`.env.local`, ver `.env.example`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ANTHROPIC_API_KEY` (server-only), `NEXT_PUBLIC_SITE_URL`.

## Comandos

- `npm run dev` — desarrollo local (http://localhost:3000)
- `npm run build` — build de producción
- `npm run lint` — linter

## Estado por fases

- [x] **Fase 0** — Setup, marca, login (Supabase Auth) y deploy. Shell de app con sidebar/topbar.
- [ ] **Fase 1** — Cerebro (`brain/system-prompt.md` con Julian Alborna + regla de 3 estructuras) + knowledge + ruta Anthropic con caching + pantalla Cerebro.
- [ ] **Fase 2** — Clientes (CRM-lite): cliente ideal, nicho, dolor, deseo, tono + RLS.
- [ ] **Fase 3** — Generación: brief → 3 estructuras + explicación → guion (Reel/carrusel).
- [ ] **Fase 4** — Edición por IA (lenguaje natural) + editor manual + versionado/export.
- [ ] **Fase 5** — Mejora continua: detección de info pobre + investigación + feedback.
- [ ] **Fase 6** — Hardening multi-tenant + base SaaS + placeholder YouTube.

> Al cerrar cada fase: actualizar este archivo y entregar a Paco un prompt copy-paste
> para la siguiente fase.
