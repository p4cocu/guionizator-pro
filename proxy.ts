import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16: el antiguo "middleware" ahora es "proxy".
//
// ⚠️ Esto corre como la ÚNICA edge function del sitio en Netlify
// (`___netlify-edge-handler-node-middleware`). Cualquier excepción que salga de
// acá no se ve como un error de la app: Netlify responde con su pantalla
// "This edge function has crashed / edge function invocation failed", sin CSS,
// sin sesión y sin forma de que el usuario haga nada.
//
// `updateSession` llama a `supabase.auth.getUser()`, que es una request de red:
// un corte transitorio, un timeout o un 5xx de Supabase alcanzan para tumbar la
// pantalla entera. Por eso el try/catch: si la verificación de sesión falla, la
// request PASA y la página decide. Eso no abre ningún agujero — el middleware
// nunca fue el candado real (lo son la RLS, `requirePortalClient` y el
// `getUser()` de cada server component): un usuario sin sesión que llegue hasta
// la página igual termina redirigido a /login por el layout.
export async function proxy(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (e) {
    console.error("[proxy] updateSession falló, se deja pasar la request:", e);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto estáticos e imágenes:
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
