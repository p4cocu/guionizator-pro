/**
 * Grupo de rutas `(portal)` — lo que ve un cliente externo (Fase D, etapa 4).
 *
 * Vive aparte de `(app)` a propósito: las páginas de `(app)` asumen "veo todos
 * mis clientes" y reusarlas era el camino corto a una fuga. Acá cada pantalla
 * arranca de una marca concreta y no existe forma de listar las demás.
 *
 * Este layout solo exige sesión. El acceso a la marca lo valida
 * `[clientId]/layout.tsx` con `requirePortalClient`, y lo que se puede leer de
 * verdad lo decide la RLS.
 *
 * `/portal` NO va en PUBLIC_PATHS: se autentica por sesión, como el resto de la
 * app. El middleware ya manda a `/login` a quien entre sin sesión; el
 * `redirect` de acá es el cinturón por si el matcher cambia.
 */

import { requirePortalSession } from "@/lib/portal/access";

export const metadata = { title: "Portal — Guionizator Pro" };

export default async function PortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePortalSession();
  return <>{children}</>;
}
