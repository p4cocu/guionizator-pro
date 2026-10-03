"use client";

/**
 * "Tu estrategia" del portal: el test o su resultado.
 *
 * La estrategia vive en estado local y la action devuelve la guardada:
 * `revalidatePath` no toca un `useState` inicializado desde props.
 */

import { useState } from "react";
import StrategyTestForm from "@/components/strategy/StrategyTestForm";
import { ANDREA_PILLAR_PLAIN, PHASE_PLAIN } from "@/lib/strategy/test";
import type { PortalStrategy } from "@/lib/portal/strategy";
import type { ContentIdea } from "@/lib/strategy/pillars";
import type { PortalUsage } from "@/lib/portal/weekIdeas";
import { enviarTestEstrategia } from "./actions";
import WeekIdeasPanel from "./WeekIdeasPanel";
import s from "./estrategia.module.css";

/** Los campos del cliente ideal, con nombres que entiende el dueño del negocio. */
const PLAIN_FIELDS: { key: "avatar" | "dolores" | "deseos" | "objeciones" | "transformacion" | "diferenciador"; label: string }[] = [
  { key: "avatar", label: "Tu cliente" },
  { key: "dolores", label: "Lo que le duele" },
  { key: "deseos", label: "Lo que quiere" },
  { key: "objeciones", label: "Lo que lo frena para comprar" },
  { key: "transformacion", label: "El cambio que le das" },
  { key: "diferenciador", label: "Por qué contigo" },
];

export default function EstrategiaPortalClient({
  clientId,
  brandLabel,
  initial,
  canEdit,
  week,
}: {
  clientId: string;
  brandLabel: string;
  initial: PortalStrategy;
  canEdit: boolean;
  week: { canGenerate: boolean; initialSaved: ContentIdea[]; initialUsage: PortalUsage | null };
}) {
  const [strategy, setStrategy] = useState<PortalStrategy>(initial);
  const hasStrategy = strategy.pillars.length > 0 || Boolean(strategy.avatar);
  const [testing, setTesting] = useState(!hasStrategy && canEdit);

  async function submit(answers: Record<string, string>): Promise<string | null> {
    const res = await enviarTestEstrategia({ clientId, answers });
    if (!res.ok) return res.error;
    setStrategy(res.strategy);
    setTesting(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return null;
  }

  const phase = strategy.account_phase ? PHASE_PLAIN[strategy.account_phase] : null;

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <span className="eyebrow">{brandLabel}</span>
        <h2 className={s.title}>Tu estrategia</h2>
        <p className={s.subtitle}>
          {testing
            ? "Responde con tus palabras, sin pensarlo tanto. Con esto armamos a quién le hablas, de qué temas conviene hablar y qué tipo de contenido te sirve hoy. Toma unos 10 minutos."
            : "A quién le hablas, de qué vas a hablar y qué tipo de contenido te conviene ahora. Es la base con la que se escriben tus guiones."}
        </p>
      </div>

      {testing ? (
        <StrategyTestForm
          initial={strategy.test_answers}
          submitLabel="✦ Armar mi estrategia"
          busyLabel="Armando tu estrategia… (unos 20 segundos)"
          warning={hasStrategy ? "Al enviarlo, tu estrategia actual se reemplaza por la nueva." : null}
          onSubmit={submit}
          onCancel={hasStrategy ? () => setTesting(false) : undefined}
        />
      ) : !hasStrategy ? (
        <p className={s.empty}>
          Todavía no hay una estrategia para tu marca. Quien tenga permiso de edición en tu equipo puede hacer el test desde aquí.
        </p>
      ) : (
        <>
          {phase && (
            <section className={s.phase}>
              <span className={s.phaseEyebrow}>Dónde está tu cuenta hoy</span>
              <h3 className={s.phaseTitle}>{phase.title}</h3>
              <p className={s.phaseBody}>{phase.body}</p>
            </section>
          )}

          <section className={s.section}>
            <h3 className={s.sectionTitle}>A quién le hablas</h3>
            <dl className={s.fields}>
              {PLAIN_FIELDS.filter((f) => strategy[f.key]).map((f) => (
                <div key={f.key} className={s.field}>
                  <dt>{f.label}</dt>
                  <dd>{strategy[f.key]}</dd>
                </div>
              ))}
            </dl>
          </section>

          {strategy.pillars.length > 0 && (
            <section className={s.section}>
              <h3 className={s.sectionTitle}>De esto vas a hablar</h3>
              <div className={s.pillars}>
                {strategy.pillars.map((p) => (
                  <article key={p.key} className={s.pillar}>
                    <div className={s.pillarHead}>
                      <h4 className={s.pillarName}>{p.name}</h4>
                      <span className={s.share}>{p.share}% del mes</span>
                    </div>
                    <span className={s.kind}>{ANDREA_PILLAR_PLAIN[p.andrea_pillar]}</span>
                    {p.objective && <p className={s.objective}>{p.objective}</p>}
                    {p.topics && (
                      <ul className={s.topics}>
                        {p.topics
                          .split("\n")
                          .map((t) => t.replace(/^[-•·*]\s*/, "").trim())
                          .filter(Boolean)
                          .map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {strategy.pillars.length > 0 && (
            <WeekIdeasPanel
              clientId={clientId}
              pillars={strategy.pillars}
              canGenerate={week.canGenerate}
              canSave={canEdit}
              initialSaved={week.initialSaved}
              initialUsage={week.initialUsage}
            />
          )}

          {canEdit && (
            <div className={s.retake}>
              <button type="button" className="btn btn-secondary" onClick={() => setTesting(true)}>
                Volver a hacer el test
              </button>
              <span className={s.retakeHint}>¿Cambió tu negocio o algo no te representa? Rehazlo y se actualiza.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
