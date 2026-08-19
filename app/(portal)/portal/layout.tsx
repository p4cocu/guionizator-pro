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
 *
 * Desde la etapa 8 este layout es además la puerta del **nombre de usuario**:
 * quien no tenga fila en `portal_profiles` ve `NameGate` en lugar de cualquier
 * pantalla del portal. Va acá y no en `[clientId]/layout.tsx` para que cubra
 * también el selector de marcas y la pantalla de "sin marca asignada". Aplica
 * igual al dueño: Paco entra una vez, pone su nombre, y con eso sus comentarios
 * dejan de mostrarle el email al cliente. El estudio `(app)` no tiene gate.
 */

import { requirePortalSession } from "@/lib/portal/access";
import {
  getDisplayName,
  DISPLAY_NAME_HINT,
  DISPLAY_NAME_MAX,
} from "@/lib/portal/profiles";
import NameGate from "./NameGate";

export const metadata = { title: "Portal — Guionizator Pro" };

export default async function PortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requirePortalSession();

  const displayName = await getDisplayName(user.id);
  if (!displayName) {
    return (
      <NameGate
        email={user.email ?? null}
        hint={DISPLAY_NAME_HINT}
        maxLength={DISPLAY_NAME_MAX}
      />
    );
  }

  return <>{children}</>;
}
