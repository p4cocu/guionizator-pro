# SETUP — Guionizator Pro (Fase 0)

Guía paso a paso para dejar la app corriendo en local y desplegada en
`guionizator.pacocuevasia.com`. No hace falta saber programar: sigue el orden.

---

## 1. Crear cuenta y proyecto en Supabase (base de datos + login)

1. Entra a https://supabase.com → **Start your project** → regístrate (puedes usar tu Google).
2. **New project**:
   - Name: `guionizator-pro`
   - Database Password: genera una fuerte y **guárdala** (la necesitarás algún día, no para Fase 0).
   - Region: la más cercana (ej. `East US` o `South America (São Paulo)`).
3. Espera ~2 min a que se aprovisione.
4. Ve a **Project Settings → API** y copia:
   - **Project URL** → será `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Crea tu usuario (como eres el único, lo creamos a mano para no depender de correos):
   - **Authentication → Users → Add user → Create new user**
   - Email: tu correo. Password: una que recuerdes. Marca **Auto Confirm User**.
   - (Alternativa: usar el botón "Crear cuenta" en la app, pero requiere confirmar por correo.)

---

## 2. Crear API key de Anthropic (el cerebro — se usa desde Fase 1)

1. Entra a https://console.anthropic.com → regístrate.
2. **Settings → API Keys → Create Key**. Nómbrala `guionizator-pro`.
3. Copia la key (empieza con `sk-ant-...`) → será `ANTHROPIC_API_KEY`.
   > Esta key es **secreta**: solo va en variables de entorno del servidor, nunca en el navegador.
4. Carga algo de saldo en **Billing** (con ~$5–10 USD sobra para probar).

---

## 3. Configurar el proyecto en local

1. En la carpeta del proyecto, abre el archivo **`.env.local`** y reemplaza los placeholders:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=la-anon-key
   ANTHROPIC_API_KEY=sk-ant-...        # puede quedar vacía hasta Fase 1
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
2. En la terminal, dentro de la carpeta del proyecto:
   ```bash
   npm run dev
   ```
3. Abre http://localhost:3000 → te manda a **/login**. Entra con el usuario del paso 1.5.
   Deberías ver el **Inicio** con la hoja de ruta. ✅ Fase 0 funcionando en local.

---

## 4. Subir el código a GitHub (para que Netlify lo despliegue)

1. Crea un repositorio en https://github.com/new (privado), ej. `guionizator-pro`.
2. En la terminal del proyecto:
   ```bash
   git init
   git add .
   git commit -m "Fase 0: setup, marca, auth y shell"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/guionizator-pro.git
   git push -u origin main
   ```
   > `.env.local` NO se sube (está en `.gitignore`). Las keys van en Netlify (paso 5).

---

## 5. Desplegar en Netlify

1. Entra a https://netlify.com → regístrate (puedes usar GitHub).
2. **Add new site → Import an existing project → GitHub** → elige `guionizator-pro`.
3. Netlify detecta Next.js automáticamente (ya está `netlify.toml`). Deja el build por defecto.
4. **Antes de desplegar**, ve a **Site configuration → Environment variables** y agrega las 4:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://guionizator.pacocuevasia.com`
5. **Deploy site**. En ~2 min tendrás una URL temporal `xxxx.netlify.app`. Pruébala.

---

## 6. Conectar el subdominio `guionizator.pacocuevasia.com`

1. En Netlify: **Domain management → Add a domain** → escribe
   `guionizator.pacocuevasia.com` → **Add**.
2. Netlify te dará un registro **CNAME** (apunta a tu sitio `.netlify.app`).
3. Entra al panel DNS donde administras `pacocuevasia.com` (tu registrador/host) y crea:
   - Tipo: **CNAME** · Nombre/Host: `guionizator` · Valor: `xxxx.netlify.app`
4. Espera la propagación (minutos a un par de horas). Netlify emite el **HTTPS** automático.
5. En Supabase: **Authentication → URL Configuration** agrega a *Redirect URLs*:
   - `https://guionizator.pacocuevasia.com/auth/callback`
   - `http://localhost:3000/auth/callback`

---

## Listo

Cuando puedas entrar en `https://guionizator.pacocuevasia.com` con tu usuario y ver el
Inicio, **Fase 0 está completa**. Avísame y arrancamos la **Fase 1 (el Cerebro)**.
