"use client";

/**
 * Panel "Portal del cliente" del perfil de una marca (Fase D, etapa 2).
 *
 * Tres bloques: qué secciones ve el cliente, el add-on de pago de IA (switch +
 * tope + consumo del mes) y quién tiene acceso.
 *
 * Los toggles guardan en cada click, con UI optimista: si el server action
 * falla, se revierte el switch y el error se muestra en línea. Todas las
 * llamadas van dentro de try/catch — un server action de mutación sin catch
 * deja la pantalla en "This page couldn't load" (regla dura de CLAUDE.md).
 *
 * Ojo: prender un flag acá NO le da acceso a nadie por sí solo. El flag decide
 * qué se dibuja en `/portal` (etapa 4); quien entra son los miembros, y lo que
 * puede leer lo decide la RLS de la migración `0006`.
 */

import { useState, useTransition } from "react";
import {
  inviteClientMember,
  regenerateInviteLink,
  removeClientMember,
  revokeClientInvite,
  setAiGenerationLimit,
  setAiGenerationMode,
  setClientFeatures,
  setClientMemberRole,
} from "../portalActions";
import type { ClientInvite } from "@/lib/portal/invites";
import {
  AI_FEATURE_SLUG,
  FREE_PORTAL_FEATURES,
  PAID_PORTAL_FEATURES,
  sanitizeFeatures,
  type PortalFeature,
} from "@/lib/portal/features";
import {
  GENERATION_MODES,
  sanitizeGenerationMode,
  type PortalGenerationMode,
} from "@/lib/portal/generationMode";
import type { PortalMember } from "@/lib/portal/members";
import {
  PORTAL_MEMBER_ROLES,
  portalMemberRoleLabel,
  type PortalMemberRole,
} from "@/lib/portal/roles";
import type { AiUsageSummary } from "@/lib/portal/usage";
import s from "../clientes.module.css";

type Props = {
  clientId: string;
  initialFeatures: string[];
  initialLimit: number | null;
  initialMode: string;
  usage: AiUsageSummary;
  initialMembers: PortalMember[];
  initialInvites: ClientInvite[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "vence en 6 días" / "venció el 20 ago". */
function expiryLabel(invite: ClientInvite): string {
  if (invite.status === "vencida") return `Venció el ${formatDate(invite.expiresAt)}`;
  const days = Math.max(
    0,
    Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / 86400000),
  );
  if (days === 0) return "Vence hoy";
  return `Vence en ${days} ${days === 1 ? "día" : "días"}`;
}

/**
 * ⚠️ `timeZone: "UTC"` no es opcional: `usage.monthStart` es el día 1 a las
 * 00:00 **UTC** (así lo corta `lib/portal/usage.ts`, para coincidir con el
 * `created_at` de Postgres). Formateado en la hora de México eso cae el último
 * día del mes anterior, y el panel decía "julio" estando en agosto.
 */
function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function PortalSection({
  clientId,
  initialFeatures,
  initialLimit,
  initialMode,
  usage,
  initialMembers,
  initialInvites,
}: Props) {
  const [features, setFeatures] = useState<string[]>(() => sanitizeFeatures(initialFeatures));
  const [limit, setLimit] = useState<number | null>(initialLimit);
  const [mode, setMode] = useState<PortalGenerationMode>(() =>
    sanitizeGenerationMode(initialMode),
  );
  const [limitDraft, setLimitDraft] = useState(initialLimit === null ? "" : String(initialLimit));
  const [members, setMembers] = useState<PortalMember[]>(initialMembers);
  const [invites, setInvites] = useState<ClientInvite[]>(initialInvites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<PortalMemberRole>("viewer");
  // El link solo existe en memoria: en la base queda su sha256, así que si se
  // recarga la página no hay forma de volver a mostrarlo (hay que regenerarlo).
  const [freshLink, setFreshLink] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const aiEnabled = features.includes(AI_FEATURE_SLUG);
  const limitDirty = limitDraft.trim() !== (limit === null ? "" : String(limit));
  const overLimit = limit !== null && usage.used >= limit;

  function toggleFeature(slug: string, on: boolean) {
    const previous = features;
    const next = sanitizeFeatures(on ? [...features, slug] : features.filter((f) => f !== slug));

    setFeatures(next);
    setError(null);
    setOk(null);

    start(async () => {
      try {
        const res = await setClientFeatures(clientId, next);
        if (res.ok) {
          setFeatures(res.features);
        } else {
          setFeatures(previous);
          setError(res.error);
        }
      } catch (e) {
        setFeatures(previous);
        setError(e instanceof Error ? e.message : "No se pudieron guardar las secciones.");
      }
    });
  }

  function saveLimit() {
    const raw = limitDraft.trim();
    const parsed = raw === "" ? null : Number(raw);

    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
      setError("El tope tiene que ser un número entero mayor o igual a 0 (o vacío, para sin tope).");
      return;
    }

    setError(null);
    setOk(null);

    start(async () => {
      try {
        const res = await setAiGenerationLimit(clientId, parsed);
        if (res.ok) {
          setLimit(res.limit);
          setLimitDraft(res.limit === null ? "" : String(res.limit));
          setOk(
            res.limit === null
              ? "Tope quitado: generaciones ilimitadas."
              : `Tope guardado: ${res.limit} generaciones al mes.`,
          );
        } else {
          setError(res.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar el tope.");
      }
    });
  }

  /** El modo se guarda al instante, con UI optimista como los toggles. */
  function changeMode(next: PortalGenerationMode) {
    const previous = mode;
    setMode(next);
    setError(null);
    setOk(null);

    start(async () => {
      try {
        const res = await setAiGenerationMode(clientId, next);
        if (res.ok) {
          setOk(
            res.mode === "simple"
              ? "Tu cliente va a ver el flujo corto: escribe el pedido y recibe el guion."
              : "Tu cliente va a elegir la idea central y la estructura antes del guion.",
          );
        } else {
          setMode(previous);
          setError(res.error);
        }
      } catch (e) {
        setMode(previous);
        setError(e instanceof Error ? e.message : "No se pudo guardar el modo.");
      }
    });
  }

  function changeRole(member: PortalMember, role: PortalMemberRole) {
    const previous = members;

    setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role } : m)));
    setError(null);
    setOk(null);
    setBusyId(member.id);

    start(async () => {
      try {
        const res = await setClientMemberRole(member.id, clientId, role);
        if (res.ok) {
          setOk(`Rol actualizado para ${member.email ?? "el miembro"}.`);
        } else {
          setMembers(previous);
          setError(res.error);
        }
      } catch (e) {
        setMembers(previous);
        setError(e instanceof Error ? e.message : "No se pudo cambiar el rol.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function revoke(member: PortalMember) {
    const who = member.email ?? "este usuario";
    if (
      !confirm(
        `¿Quitarle el acceso a ${who}? Deja de ver esta marca al instante. Sus comentarios y las ediciones que haya hecho no se borran.`,
      )
    ) {
      return;
    }

    const previous = members;

    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    setError(null);
    setOk(null);
    setBusyId(member.id);

    start(async () => {
      try {
        const res = await removeClientMember(member.id, clientId);
        if (res.ok) {
          setOk(`${who} ya no tiene acceso a esta marca.`);
        } else {
          setMembers(previous);
          setError(res.error);
        }
      } catch (e) {
        setMembers(previous);
        setError(e instanceof Error ? e.message : "No se pudo revocar el acceso.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setCopied(false);

    const email = inviteEmail.trim();
    if (!email) {
      setError("Escribe el correo de la persona que quieres invitar.");
      return;
    }

    start(async () => {
      try {
        const res = await inviteClientMember(clientId, email, inviteRole);
        if (res.ok) {
          setInvites((prev) => [
            res.invite,
            ...prev.filter((i) => i.email.toLowerCase() !== res.invite.email.toLowerCase()),
          ]);
          setFreshLink({ email: res.invite.email, url: res.url });
          setInviteEmail("");
          setOk(null);
        } else {
          setError(res.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo crear la invitación.");
      }
    });
  }

  function regenerate(inviteItem: ClientInvite) {
    setError(null);
    setOk(null);
    setCopied(false);
    setBusyId(inviteItem.id);

    start(async () => {
      try {
        const res = await regenerateInviteLink(inviteItem.id, clientId);
        if (res.ok) {
          setInvites((prev) => prev.map((i) => (i.id === res.invite.id ? res.invite : i)));
          setFreshLink({ email: res.invite.email, url: res.url });
        } else {
          setError(res.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo regenerar el link.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function cancelInvite(inviteItem: ClientInvite) {
    if (!confirm(`¿Cancelar la invitación de ${inviteItem.email}? El link deja de servir.`)) {
      return;
    }

    const previous = invites;

    setInvites((prev) => prev.filter((i) => i.id !== inviteItem.id));
    setError(null);
    setOk(null);
    setBusyId(inviteItem.id);
    if (freshLink?.email.toLowerCase() === inviteItem.email.toLowerCase()) setFreshLink(null);

    start(async () => {
      try {
        const res = await revokeClientInvite(inviteItem.id, clientId);
        if (res.ok) {
          setOk(`Invitación de ${inviteItem.email} cancelada.`);
        } else {
          setInvites(previous);
          setError(res.error);
        }
      } catch (e) {
        setInvites(previous);
        setError(e instanceof Error ? e.message : "No se pudo cancelar la invitación.");
      } finally {
        setBusyId(null);
      }
    });
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles (o http sin localhost): el link igual está
      // en el input de al lado para copiarlo a mano.
      setError("No se pudo copiar solo. Selecciona el link y cópialo a mano.");
    }
  }

  function renderToggle(feature: PortalFeature) {
    const on = features.includes(feature.slug);
    return (
      <label
        key={feature.slug}
        className={`${s.featureRow} ${on ? s.featureRowOn : ""}`}
      >
        <input
          type="checkbox"
          className={s.switchInput}
          checked={on}
          disabled={isPending}
          onChange={(e) => toggleFeature(feature.slug, e.target.checked)}
        />
        <span className={s.switchTrack}>
          <span className={s.switchThumb} />
        </span>
        <span className={s.featureText}>
          <span className={s.featureLabel}>{feature.label}</span>
          <span className={s.featureDescription}>{feature.description}</span>
        </span>
      </label>
    );
  }

  const enabledCount = FREE_PORTAL_FEATURES.filter((f) => features.includes(f.slug)).length;

  return (
    <div className={s.productsSection}>
      <h2 className={s.productsTitle}>Portal del cliente</h2>
      <p className={s.productsSubtitle}>
        Qué ve esta marca cuando entra con su propio login. Los flags deciden qué
        secciones se dibujan; quién entra lo deciden los miembros de abajo.
      </p>

      <div className={s.portalGroup}>
        <p className={s.portalGroupTitle}>
          Secciones incluidas · {enabledCount} de {FREE_PORTAL_FEATURES.length} prendidas
        </p>
        <div className={s.featureList}>{FREE_PORTAL_FEATURES.map(renderToggle)}</div>
      </div>

      {PAID_PORTAL_FEATURES.map((feature) => (
        <div key={feature.slug} className={s.portalGroup}>
          <div className={s.addonCard}>
            <div className={s.addonHeader}>
              <span className={s.addonBadge}>Add-on de pago</span>
            </div>
            {renderToggle(feature)}

            {aiEnabled && feature.slug === AI_FEATURE_SLUG && (
              <div className={s.addonBody}>
                <div className={s.limitField}>
                  <label className="field-label" style={{ fontSize: 12 }} htmlFor="ai-limit">
                    Tope mensual
                  </label>
                  <input
                    id="ai-limit"
                    className={`input ${s.limitInput}`}
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Sin tope"
                    value={limitDraft}
                    disabled={isPending}
                    onChange={(e) => setLimitDraft(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 13 }}
                  disabled={isPending || !limitDirty}
                  onClick={saveLimit}
                >
                  {isPending ? "…" : "Guardar tope"}
                </button>

                <div className={s.modeField}>
                  <span className="field-label" style={{ fontSize: 12 }}>
                    Flujo que ve el cliente
                  </span>
                  <div className={s.modeOptions}>
                    {GENERATION_MODES.map((m) => (
                      <label
                        key={m.value}
                        className={`${s.modeOption} ${mode === m.value ? s.modeOptionOn : ""}`}
                      >
                        <input
                          type="radio"
                          name="ai-generation-mode"
                          className={s.modeRadio}
                          value={m.value}
                          checked={mode === m.value}
                          disabled={isPending}
                          onChange={() => changeMode(m.value)}
                        />
                        <span>
                          <span className={s.modeLabel}>{m.label}</span>
                          <span className={s.modeDescription}>{m.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <p className={s.usageText}>
                  Consumo de {formatMonth(usage.monthStart)}:{" "}
                  <strong className={overLimit ? s.usageOver : undefined}>
                    {usage.used}
                    {limit !== null ? ` de ${limit}` : ""}
                  </strong>{" "}
                  {limit === null ? "generaciones (sin tope)" : "generaciones"}
                  {overLimit ? " — tope alcanzado" : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}

      <div className={s.portalGroup}>
        <p className={s.portalGroupTitle}>Quién tiene acceso</p>

        <form onSubmit={invite} className={s.inviteForm}>
          <div className={s.inviteEmailField}>
            <label className="field-label" style={{ fontSize: 12 }} htmlFor="invite-email">
              Invitar por correo
            </label>
            <input
              id="invite-email"
              type="email"
              className="input"
              placeholder="cliente@sumarca.com"
              value={inviteEmail}
              disabled={isPending}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div className={s.inviteRoleField}>
            <label className="field-label" style={{ fontSize: 12 }} htmlFor="invite-role">
              Rol
            </label>
            <select
              id="invite-role"
              className={`input ${s.memberRoleSelect}`}
              value={inviteRole}
              disabled={isPending}
              onChange={(e) => setInviteRole(e.target.value as PortalMemberRole)}
            >
              {PORTAL_MEMBER_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ fontSize: 13 }}
            disabled={isPending || !inviteEmail.trim()}
          >
            {isPending ? "…" : "Generar link"}
          </button>
        </form>

        {freshLink && (
          <div className={s.linkBox}>
            <p className={s.linkBoxTitle}>Link para {freshLink.email}</p>
            <p className={s.linkBoxText}>
              Mándaselo por donde quieras. Vence en 7 días y sirve una sola vez.
              Se muestra ahora nada más: al recargar la página no se puede volver
              a ver (en la base solo queda su huella), pero puedes generar uno
              nuevo cuando quieras.
            </p>
            <div className={s.linkRow}>
              <input
                className={`input ${s.linkInput}`}
                readOnly
                value={freshLink.url}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 13 }}
                onClick={() => copyLink(freshLink.url)}
              >
                {copied ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        )}

        {invites.length > 0 && (
          <div className={s.memberList} style={{ marginBottom: 12 }}>
            {invites.map((inviteItem) => (
              <div key={inviteItem.id} className={s.inviteRow}>
                <div className={s.inviteInfo}>
                  <p className={s.inviteEmail}>{inviteItem.email}</p>
                  <p
                    className={`${s.inviteMeta} ${
                      inviteItem.status === "vencida" ? s.inviteExpired : ""
                    }`}
                  >
                    Invitado como {portalMemberRoleLabel(inviteItem.role).toLowerCase()} ·{" "}
                    {expiryLabel(inviteItem)} · sin aceptar
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 13 }}
                  disabled={isPending && busyId === inviteItem.id}
                  onClick={() => regenerate(inviteItem)}
                >
                  Nuevo link
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 13 }}
                  disabled={isPending && busyId === inviteItem.id}
                  onClick={() => cancelInvite(inviteItem)}
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        )}

        {members.length === 0 ? (
          <div className={s.memberEmpty}>
            Todavía nadie aceptó. Cuando el invitado cree su cuenta con el link,
            aparece aquí y puedes cambiarle el rol o quitarle el acceso.
          </div>
        ) : (
          <div className={s.memberList}>
            {members.map((member) => (
              <div key={member.id} className={s.memberRow}>
                <div className={s.memberInfo}>
                  <p className={s.memberEmail}>
                    {member.email ?? <span style={{ opacity: 0.7 }}>{member.userId}</span>}
                  </p>
                  <p className={s.memberMeta}>
                    Con acceso desde el {formatDate(member.createdAt)}
                    {member.email ? "" : " · no se pudo resolver el email"}
                  </p>
                </div>

                <select
                  className={`input ${s.memberRoleSelect}`}
                  value={member.role}
                  disabled={isPending && busyId === member.id}
                  onChange={(e) => changeRole(member, e.target.value as PortalMemberRole)}
                  aria-label={`Rol de ${member.email ?? member.userId}`}
                >
                  {PORTAL_MEMBER_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 13 }}
                  disabled={isPending && busyId === member.id}
                  onClick={() => revoke(member)}
                >
                  Revocar
                </button>
              </div>
            ))}
          </div>
        )}

        <p className={s.memberMeta} style={{ marginTop: 10 }}>
          {PORTAL_MEMBER_ROLES.map((r) => `${r.label}: ${r.description}`).join(" · ")}
        </p>
      </div>

      {error && (
        <p className={s.formError} style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
      {ok && <p className={s.portalOk}>{ok}</p>}
    </div>
  );
}
