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
  removeClientMember,
  setAiGenerationLimit,
  setClientFeatures,
  setClientMemberRole,
} from "../portalActions";
import {
  AI_FEATURE_SLUG,
  FREE_PORTAL_FEATURES,
  PAID_PORTAL_FEATURES,
  sanitizeFeatures,
  type PortalFeature,
} from "@/lib/portal/features";
import {
  PORTAL_MEMBER_ROLES,
  type PortalMember,
  type PortalMemberRole,
} from "@/lib/portal/members";
import type { AiUsageSummary } from "@/lib/portal/usage";
import s from "../clientes.module.css";

type Props = {
  clientId: string;
  initialFeatures: string[];
  initialLimit: number | null;
  usage: AiUsageSummary;
  initialMembers: PortalMember[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

export default function PortalSection({
  clientId,
  initialFeatures,
  initialLimit,
  usage,
  initialMembers,
}: Props) {
  const [features, setFeatures] = useState<string[]>(() => sanitizeFeatures(initialFeatures));
  const [limit, setLimit] = useState<number | null>(initialLimit);
  const [limitDraft, setLimitDraft] = useState(initialLimit === null ? "" : String(initialLimit));
  const [members, setMembers] = useState<PortalMember[]>(initialMembers);
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

        {members.length === 0 ? (
          <div className={s.memberEmpty}>
            Todavía nadie entra a esta marca. Las invitaciones por email llegan en
            la próxima etapa; por ahora las membresías se cargan a mano en
            Supabase (<code>client_members</code>).
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
