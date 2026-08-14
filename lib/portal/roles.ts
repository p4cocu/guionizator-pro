/**
 * Roles del portal de cliente. Módulo **puro**: sin Supabase, sin service role,
 * sin `node:crypto`.
 *
 * Vive aparte de `lib/portal/members.ts` a propósito. Ese módulo importa
 * `createServiceClient`, así que si un componente `"use client"` importara de
 * ahí aunque sea una etiqueta, se arrastraría el cliente de service role al
 * bundle del browser. La key no se filtraría (Next solo inyecta `NEXT_PUBLIC_*`),
 * pero es código de servidor cruzando una frontera que no debería cruzar.
 *
 * Espeja el `CHECK` de `client_members.role` (migración `0006`):
 *   check (role in ('viewer','collaborator'))
 * Agregar un rol acá obliga a entregar el `ALTER TABLE` en el mismo cambio.
 */

export type PortalMemberRole = "viewer" | "collaborator";

export const PORTAL_MEMBER_ROLES: {
  value: PortalMemberRole;
  label: string;
  description: string;
}[] = [
  {
    value: "viewer",
    label: "Lector",
    description: "Ve las secciones habilitadas y comenta. No modifica nada.",
  },
  {
    value: "collaborator",
    label: "Colaborador",
    description: "Además edita los guiones de su marca (no puede crearlos ni borrarlos).",
  },
];

export function isPortalMemberRole(value: string): value is PortalMemberRole {
  return value === "viewer" || value === "collaborator";
}

export function portalMemberRoleLabel(role: string): string {
  return PORTAL_MEMBER_ROLES.find((r) => r.value === role)?.label ?? role;
}
