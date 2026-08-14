import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rutas públicas que no requieren sesión. */
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  // Invitaciones al portal de cliente: el invitado llega SIN sesión (todavía no
  // tiene cuenta). Si esta ruta no estuviera acá, el middleware lo mandaría a
  // /login y el link no serviría para nada. La invitación se valida por su
  // token (sha256 en client_invites), no por sesión — y aceptar sí exige estar
  // logueado con el email invitado.
  "/invitacion",
  // Endpoint de ingesta del Shortcut: se autentica por token (Bearer), no por
  // sesión, así que no debe redirigir a /login.
  "/api/resources/ingest",
  // Netlify Background/Scheduled Functions: se llaman server-to-server (sin
  // cookies de sesión) y se autentican con su propio secreto de header
  // (ej. x-scrape-secret). Si el matcher las intercepta, el middleware las
  // redirige (307) a /login antes de que corra su código — el fetch() que las
  // dispara no lanza error con un 307, así que el fallo queda silencioso.
  "/.netlify/functions",
];

/**
 * Refresca la sesión de Supabase en cada request y protege las rutas privadas.
 * Llamado desde el middleware raíz.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: no ejecutar lógica entre createServerClient y getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Con sesión, /login no tiene nada que ofrecer. Se manda a `/` y NO a
  // `/dashboard`: quién va al estudio y quién al portal lo decide `app/page.tsx`
  // (consultando la base). Acá no se puede: el middleware corre en CADA request
  // y meterle dos consultas sería pagar ese costo en toda la app.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
