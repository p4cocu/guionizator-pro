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
  createPasswordRecoveryLink,
  inviteClientMember,
  regenerateInviteLink,
  removeClientMember,
  revokeClientInvite,
  setAiGenerationLimit,
  setAiGenerationMode,
  setClientFeatures,
  setClientMemberRole,
  setMemberName,
  setOwnPortalName,
  setTranscriptionLimit,
} from "../portalActions";
import type { TranscriptionUsageSummary } from "@/lib/competencia/transcriptionUsage";
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
import { DISPLAY_NAME_HINT, DISPLAY_NAME_MAX } from "@/lib/portal/profiles";
import {
  PORTAL_MEMBER_ROLES,
  portalMemberRoleLabel,
  type PortalMemberRole,
} from "@/lib/portal/roles";
import type { AiUsageSummary } from "@/lib/portal/usage";
import { PLAN_AI_CREDITS, PLAN_TRANSCRIPTIONS } from "@/lib/billing/plan";
import s from "../clientes.module.css";

type Props = {
  clientId: string;
  initialFeatures: string[];
  initialLimit: number | null;
  initialMode: string;
  usage: AiUsageSummary;
  initialTranscriptionLimit: number | null;
  transcriptionUsage: TranscriptionUsageSummary;
  initialMembers: PortalMember[];
  initialInvites: ClientInvite[];
  /** Nombre con el que Paco aparece en el portal. Global, no por marca. */
  initialOwnName: string | null;
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
 * Etiqueta del periodo que se está contando.
 *
 * Desde Fase E el corte de los dos medidores es el **ciclo de facturación** de
 * la marca, no el mes calendario: si el cliente paga el día 20, su cupo se
 * reinicia el 20. Cuando la marca no tiene suscripción de Stripe (exenta, o
 * todavía sin pagar) no hay `cycleEnd` y se cae al mes calendario de siempre.
 *
 * ⚠️ `timeZone: "UTC"` no es opcional en ese caso: el fallback es el día 1 a las
 * 00:00 **UTC** (así lo corta `lib/portal/usage.ts`, para coincidir con el
 * `created_at` de Postgres). Formateado en la hora de México eso cae el último
 * día del mes anterior, y el panel decía "julio" estando en agosto.
 */
function formatPeriod(cycleStart: string, cycleEnd: string | null): string {
  if (!cycleEnd) {
    return new Date(cycleStart).toLocaleDateString("es-MX", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  return `${day(cycleStart)} – ${day(cycleEnd)}`;
}

export default function PortalSection({
  clientId,
  initialFeatures,
  initialLimit,
  initialMode,
  usage,
  initialTranscriptionLimit,
  transcriptionUsage,
  initialMembers,
  initialInvites,
  initialOwnName,
}: Props) {
  const [features, setFeatures] = useState<string[]>(() => sanitizeFeatures(initialFeatures));
  const [limit, setLimit] = useState<number | null>(initialLimit);
  const [mode, setMode] = useState<PortalGenerationMode>(() =>
    sanitizeGenerationMode(initialMode),
  );
  const [transcriptionLimit, setTranscriptionLimitState] = useState<number | null>(
    initialTranscriptionLimit,
  );
  const [transcriptionLimitDraft, setTranscriptionLimitDraft] = useState(
    initialTranscriptionLimit === null ? "" : String(initialTranscriptionLimit),
  );
  const [limitDraft, setLimitDraft] = useState(initialLimit === null ? "" : String(initialLimit));
  const [members, setMembers] = useState<PortalMember[]>(initialMembers);
  const [invites, setInvites] = useState<ClientInvite[]>(initialInvites);
  const [ownName, setOwnName] = useState(initialOwnName ?? "");
  const [ownNameSaved, setOwnNameSaved] = useState(initialOwnName ?? "");
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<PortalMemberRole>("viewer");
  // El link solo existe en memoria: en la base queda su sha256, así que si se
  // recarga la página no hay forma de volver a mostrarlo (hay que regenerarlo).
  const [freshLink, setFreshLink] = useState<{ email: string; url: string } | null>(null);
  // Link para que un miembro ponga contraseña nueva (etapa 9). Va aparte del
  // de invitación: son dos cosas distintas y mostrarlos en la misma caja se
  // presta a mandar el que no era.
  const [passLink, setPassLink] = useState<{ email: string; url: string } | null>(null);
  const [passCopied, setPassCopied] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const aiEnabled = features.includes(AI_FEATURE_SLUG);
  const limitDirty = limitDraft.trim() !== (limit === null ? "" : String(limit));
  const overLimit = limit !== null && usage.used >= limit;
  const competenciaEnabled = features.includes("competencia");
  const transcriptionLimitDirty =
    transcriptionLimitDraft.trim() !== (transcriptionLimit === null ? "" : String(transcriptionLimit));
  const transcriptionOverLimit =
    transcriptionLimit !== null && transcriptionUsage.used >= transcriptionLimit;

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
      setError("El tope tiene que ser un número entero mayor o igual a 0, o vacío para usar el del plan.");
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

  function saveTranscriptionLimit() {
    const raw = transcriptionLimitDraft.trim();
    const parsed = raw === "" ? null : Number(raw);

    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
      setError("El tope tiene que ser un número entero mayor o igual a 0, o vacío para usar el del plan.");
      return;
    }

    setError(null);
    setOk(null);

    start(async () => {
      try {
        const res = await setTranscriptionLimit(clientId, parsed);
        if (res.ok) {
          setTranscriptionLimitState(res.limit);
          setTranscriptionLimitDraft(res.limit === null ? "" : String(res.limit));
          setOk(
            res.limit === null
              ? "Tope de transcripción quitado: ilimitadas."
              : `Tope de transcripción guardado: ${res.limit} al mes.`,
          );
        } else {
          setError(res.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar el tope de transcripción.");
      }
    });
  }

  /**
   * Guarda el nombre visible de un miembro. Optimista con reversión, igual que
   * el cambio de rol: si la action falla, la fila vuelve a lo que era y el
   * error se muestra arriba (nunca se deja la UI mintiendo).
   */
  function saveMemberName(member: PortalMember) {
    const nuevo = nameDraft.trim();
    if (!nuevo || nuevo === (member.displayName ?? "")) {
      setEditingNameId(null);
      return;
    }

    const previous = members;
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, displayName: nuevo } : m)),
    );
    setEditingNameId(null);
    setError(null);
    setOk(null);
    setBusyId(member.id);

    start(async () => {
      try {
        const res = await setMemberName(member.id, clientId, nuevo);
        if (res.ok) {
          setOk(`Nombre actualizado a ${nuevo}.`);
        } else {
          setMembers(previous);
          setError(res.error);
        }
      } catch (e) {
        setMembers(previous);
        setError(e instanceof Error ? e.message : "No se pudo guardar el nombre.");
      } finally {
        setBusyId(null);
      }
    });
  }

  /** El nombre propio de Paco: lo mismo, pero para su propia fila. */
  function saveOwnName() {
    const nuevo = ownName.trim();
    if (!nuevo || nuevo === ownNameSaved) return;

    setError(null);
    setOk(null);
    start(async () => {
      try {
        const res = await setOwnPortalName(clientId, nuevo);
        if (res.ok) {
          setOwnNameSaved(nuevo);
          setOk("Listo: tus comentarios en el portal salen con ese nombre.");
        } else {
          setError(res.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar tu nombre.");
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

  /**
   * Genera el link de contraseña nueva para ese miembro. Es el respaldo del
   * "¿Olvidaste tu contraseña?" de `/login`, para cuando el correo no llega.
   */
  function recoveryLink(member: PortalMember) {
    setError(null);
    setOk(null);
    setPassLink(null);
    setBusyId(member.id);
    start(async () => {
      try {
        const res = await createPasswordRecoveryLink(clientId, member.id);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setPassLink({ email: res.email, url: res.url });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo generar el link.");
      } finally {
        setBusyId(null);
      }
    });
  }

  async function copyPassLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setPassCopied(true);
      setTimeout(() => setPassCopied(false), 1800);
    } catch {
      setError("No se pudo copiar solo. Selecciona el link y cópialo a mano.");
    }
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

        {competenciaEnabled && (
          <div className={s.addonBody} style={{ borderTop: "1px solid var(--glass-border)", marginTop: 12, paddingTop: 12 }}>
            <div className={s.limitField}>
              <label className="field-label" style={{ fontSize: 12 }} htmlFor="transcription-limit">
                Tope de transcripción por ciclo
              </label>
              <input
                id="transcription-limit"
                className={`input ${s.limitInput}`}
                type="number"
                min={0}
                step={1}
                placeholder={`${PLAN_TRANSCRIPTIONS} (plan)`}
                value={transcriptionLimitDraft}
                disabled={isPending}
                onChange={(e) => setTranscriptionLimitDraft(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 13 }}
              disabled={isPending || !transcriptionLimitDirty}
              onClick={saveTranscriptionLimit}
            >
              {isPending ? "…" : "Guardar tope"}
            </button>
            <p className={s.usageText}>
              Consumo de {formatPeriod(transcriptionUsage.cycleStart, transcriptionUsage.cycleEnd)}:{" "}
              <strong className={transcriptionOverLimit ? s.usageOver : undefined}>
                {transcriptionUsage.used}
                {transcriptionLimit !== null ? ` de ${transcriptionLimit}` : ""}
              </strong>{" "}
              {transcriptionLimit === null
                ? `transcripciones (usa el tope del plan: ${PLAN_TRANSCRIPTIONS}, salvo que la marca sea interna)`
                : "transcripciones"}
              {transcriptionOverLimit ? " — tope alcanzado" : ""}
            </p>
          </div>
        )}
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
                    Tope de generaciones por ciclo
                  </label>
                  <input
                    id="ai-limit"
                    className={`input ${s.limitInput}`}
                    type="number"
                    min={0}
                    step={1}
                    placeholder={`${PLAN_AI_CREDITS} (plan)`}
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
                  Consumo de {formatPeriod(usage.cycleStart, usage.cycleEnd)}:{" "}
                  <strong className={overLimit ? s.usageOver : undefined}>
                    {usage.used}
                    {limit !== null ? ` de ${limit}` : ""}
                  </strong>{" "}
                  {limit === null
                    ? `generaciones (usa el tope del plan: ${PLAN_AI_CREDITS}, salvo que la marca sea interna)`
                    : "generaciones"}
                  {overLimit ? " — tope alcanzado" : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}

      <div className={s.portalGroup}>
        <p className={s.portalGroupTitle}>Quién tiene acceso</p>

        {/*
          Nombre propio (etapa 8). Es un ajuste GLOBAL —una fila por usuario en
          `portal_profiles`, no por marca— pero se edita acá porque es donde se
          ve el efecto: hasta la etapa 7 el cliente veía el email personal de
          Paco en cada respuesta.
        */}
        <div className={s.ownNameRow}>
          <div className={s.ownNameField}>
            <label className="field-label" style={{ fontSize: 12 }} htmlFor="own-portal-name">
              Tu nombre en el portal
            </label>
            <input
              id="own-portal-name"
              className="input"
              value={ownName}
              maxLength={DISPLAY_NAME_MAX}
              placeholder="Paco"
              disabled={isPending}
              onChange={(e) => setOwnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveOwnName();
              }}
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 13 }}
            disabled={isPending || ownName.trim().length < 2 || ownName.trim() === ownNameSaved}
            onClick={saveOwnName}
          >
            {isPending ? "…" : "Guardar"}
          </button>
        </div>
        <p className={s.memberMeta} style={{ marginTop: 6, marginBottom: 14 }}>
          {DISPLAY_NAME_HINT} Vale para todas tus marcas.
        </p>

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
                  {editingNameId === member.id ? (
                    <div className={s.memberNameEdit}>
                      <input
                        className="input"
                        value={nameDraft}
                        maxLength={DISPLAY_NAME_MAX}
                        autoFocus
                        disabled={isPending && busyId === member.id}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveMemberName(member);
                          if (e.key === "Escape") setEditingNameId(null);
                        }}
                        aria-label={`Nombre de ${member.email ?? member.userId}`}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        disabled={isPending && busyId === member.id}
                        onClick={() => saveMemberName(member)}
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: 12, padding: "6px 10px" }}
                        onClick={() => setEditingNameId(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <p className={s.memberEmail}>
                      {member.displayName ?? (
                        <span style={{ opacity: 0.7 }}>Sin nombre todavía</span>
                      )}{" "}
                      <button
                        type="button"
                        className={s.memberNameBtn}
                        onClick={() => {
                          setNameDraft(member.displayName ?? "");
                          setEditingNameId(member.id);
                        }}
                      >
                        editar
                      </button>
                    </p>
                  )}
                  <p className={s.memberMeta}>
                    {member.email ?? member.userId} · con acceso desde el{" "}
                    {formatDate(member.createdAt)}
                    {member.displayName ? "" : " · elige su nombre al entrar al portal"}
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
                  onClick={() => recoveryLink(member)}
                  title="Genera un link para que ponga una contraseña nueva sin saber la anterior"
                >
                  Contraseña
                </button>

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

        {passLink && (
          <div className={s.linkBox}>
            <p className={s.linkBoxTitle}>Contraseña nueva para {passLink.email}</p>
            <p className={s.linkBoxText}>
              Mándaselo por donde quieras. Al abrirlo elige una contraseña nueva
              y entra directo, sin necesitar la anterior. Sirve una sola vez y
              por un rato corto; si se vence, generas otro. Antes de usar esto,
              que pruebe el &ldquo;¿Olvidaste tu contraseña?&rdquo; de la
              pantalla de entrada: ahí se lo manda solo por correo.
            </p>
            <div className={s.linkRow}>
              <input
                className={`input ${s.linkInput}`}
                readOnly
                value={passLink.url}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 13 }}
                onClick={() => copyPassLink(passLink.url)}
              >
                {passCopied ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
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
