/**
 * Public, read-only view of a shared Artist Passport result.
 * Decodes the stateless share code, re-runs the deterministic evaluator and
 * invites the visitor to take their own Passport.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ShieldCheck, AlertTriangle, Disc3 } from 'lucide-react';
import { SIGNATURE_BUTTON_BASE, SIGNATURE_BUTTON_TONES } from '@shared/share/signatureButton';
import { evaluatePassport } from '../lib/passportEvaluator';
import { decodePassportShare, stageFor } from '../lib/passportShare';
import { trackPassportEvent } from '../lib/passportAnalytics';

const gold = SIGNATURE_BUTTON_TONES.gold;
const TAKE_YOURS = '/passport?utm_source=passport_share&utm_medium=referral';

function TakeYoursButton({ cta }: { cta: string }) {
  return (
    <Link
      to={TAKE_YOURS}
      onClick={() => trackPassportEvent('freebie_clicked', { cta })}
      className={`${SIGNATURE_BUTTON_BASE} ${gold.button} min-h-12 px-7 text-base`}
    >
      <span className={gold.label}>Get your own Passport</span>
      <ArrowRight className={`h-4 w-4 ${gold.icon}`} />
      <span aria-hidden="true" className={gold.sweep} />
    </Link>
  );
}

export default function PassportResultPage() {
  const { code } = useParams<{ code: string }>();
  const answers = useMemo(() => decodePassportShare(code), [code]);
  const report = useMemo(() => (answers ? evaluatePassport(answers) : null), [answers]);
  const tracked = useRef(false);

  useEffect(() => {
    document.title = answers ? `${stageFor(answers.careerStage).title} · Artist Passport · indii` : 'Artist Passport · indii';
    if (!tracked.current) {
      tracked.current = true;
      trackPassportEvent('passport_viewed', { surface: 'shared_result', valid: Boolean(answers) });
    }
  }, [answers]);

  if (!answers || !report) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#030303] px-4 text-center text-white">
        <Disc3 className="h-10 w-10 text-[#FFB800]" aria-hidden="true" />
        <h1 className="text-2xl font-black">This Passport link doesn&apos;t open</h1>
        <p className="max-w-md text-sm text-[#8A8F9E]">It may have been cut off when it was shared. You can take the two-minute Passport yourself.</p>
        <TakeYoursButton cta="shared_result_invalid_take_yours" />
      </main>
    );
  }

  const stage = stageFor(answers.careerStage);
  const genre = answers.genre === 'Other' && answers.customGenre ? answers.customGenre : answers.genre;
  const RightsIcon = report.rights.status === 'good' ? ShieldCheck : AlertTriangle;

  return (
    <main className="min-h-screen bg-[#030303] px-4 py-12 text-white sm:py-20">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3 text-center">
          <span className="inline-flex rounded-full border border-[#FFB800]/30 bg-[#FFB800]/10 px-3 py-1 font-mono text-xs uppercase tracking-widest text-[#FFB800]">
            Artist Passport · {stage.badge}
          </span>
          <h1 className="text-4xl font-black sm:text-5xl">{stage.title}</h1>
          <p className="text-sm text-[#8A8F9E]">{genre} · shared from indii.music</p>
        </header>

        <section className="rounded-2xl border border-[#1F222A] bg-[#070709] p-6">
          <div className="flex items-start gap-3">
            <RightsIcon className={`mt-0.5 h-5 w-5 shrink-0 ${report.rights.status === 'good' ? 'text-[#00FF66]' : 'text-[#FFC107]'}`} aria-hidden="true" />
            <div>
              <h2 className="font-bold">{report.rights.title}</h2>
              <p className="mt-1 text-sm text-white/70">{report.rights.description}</p>
            </div>
          </div>
        </section>

        {report.steps.length > 0 && (
          <section className="rounded-2xl border border-[#1F222A] bg-[#070709] p-6">
            <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#8A8F9E]">Their next moves</h2>
            <ol className="space-y-3">
              {report.steps.slice(0, 3).map((step) => (
                <li key={step.stepNumber} className="flex gap-3">
                  <span className="font-mono text-sm text-[#FFB800]">{String(step.stepNumber).padStart(2, '0')}</span>
                  <span className="text-sm font-semibold">{step.title}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="space-y-4 rounded-2xl border border-[#FFB800]/20 bg-linear-to-b from-[#FFB800]/5 to-transparent p-8 text-center">
          <h2 className="text-2xl font-black">Where does your music business stand?</h2>
          <p className="mx-auto max-w-md text-sm text-[#8A8F9E]">Seven questions. A personal gap report on rights, royalties and your next release. Free, no account needed.</p>
          <TakeYoursButton cta="shared_result_take_yours" />
        </section>
      </div>
    </main>
  );
}
