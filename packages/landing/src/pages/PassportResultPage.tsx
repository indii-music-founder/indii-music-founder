/**
 * Public, read-only view of a shared Artist Passport result.
 * Decodes the stateless share code, re-runs the deterministic evaluator and
 * invites the visitor to take their own Passport.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, Copy, ShieldCheck, AlertTriangle, Disc3 } from 'lucide-react';
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
      className={`${SIGNATURE_BUTTON_BASE} ${gold.button} min-h-12 px-7 text-base focus-visible:outline-[3px] focus-visible:outline-[#FFB800] focus-visible:outline-offset-[3px]`}
    >
      <span className={gold.label}>Get your own Passport</span>
      <ArrowRight className={`h-4 w-4 ${gold.icon}`} aria-hidden="true" />
      <span aria-hidden="true" className={gold.sweep} />
    </Link>
  );
}

export default function PassportResultPage() {
  const { code } = useParams<{ code: string }>();
  const answers = useMemo(() => decodePassportShare(code), [code]);
  const report = useMemo(() => (answers ? evaluatePassport(answers) : null), [answers]);
  const tracked = useRef(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = answers ? `${stageFor(answers.careerStage).title} · Artist Passport · indii` : 'Artist Passport · indii';
    if (!tracked.current) {
      tracked.current = true;
      trackPassportEvent('passport_viewed', { surface: 'shared_result', valid: Boolean(answers) });
    }
    return () => {
      document.title = previousTitle;
    };
  }, [answers]);

  useEffect(() => () => {
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
  }, []);

  const handleCopyResultUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  if (!answers || !report) {
    return (
      <div className="relative flex min-h-screen flex-col bg-[#000000] text-white">
        <header className="border-b border-white/10 bg-black/75 px-6 py-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <Link to="/" className="text-lg font-bold tracking-tight text-white hover:text-[#FFB800]">
              indii<span className="text-[#FFB800]">.music</span>
            </Link>
            <Link to="/passport" className="font-mono text-xs uppercase tracking-widest text-[#B4B9C7] hover:text-white">
              Artist Passport
            </Link>
          </div>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
          <Disc3 className="h-10 w-10 text-[#FFB800]" aria-hidden="true" />
          <h1 className="text-2xl font-black">This Passport link doesn&apos;t open</h1>
          <p className="max-w-md text-sm text-[#9AA1B2]">It may have been cut off when it was shared. You can take the two-minute Passport yourself.</p>
          <TakeYoursButton cta="shared_result_invalid_take_yours" />
        </main>
      </div>
    );
  }

  const stage = stageFor(answers.careerStage);
  const genre = answers.genre === 'Other' && answers.customGenre ? answers.customGenre : answers.genre;
  const RightsIcon = report.rights.status === 'good' ? ShieldCheck : AlertTriangle;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#000000] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_18%,rgba(255,184,0,0.12)_0%,rgba(230,81,0,0.04)_38%,transparent_70%)]"
      />
      <header className="relative z-10 border-b border-white/10 bg-black/75 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Link to="/" className="text-lg font-bold tracking-tight text-white hover:text-[#FFB800]">
            indii<span className="text-[#FFB800]">.music</span>
          </Link>
          <button
            type="button"
            onClick={() => void handleCopyResultUrl()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 font-mono text-xs text-white/85 transition-colors hover:border-[#FFB800]/50 hover:text-white focus-visible:outline-[3px] focus-visible:outline-[#FFB800] focus-visible:outline-offset-2"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#00FF66]" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5 text-[#FFB800]" aria-hidden="true" />}
            <span>{copied ? 'Link copied' : 'Copy link'}</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-8">
          <header className="space-y-3 text-center">
            <span className="inline-flex rounded-full border border-[#FFB800]/35 bg-[#FFB800]/10 px-3.5 py-1 font-mono text-xs uppercase tracking-widest text-[#FFB800]">
              Artist Passport · {stage.badge}
            </span>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{stage.title}</h1>
            <p className="text-sm text-[#9AA1B2]">{genre} · shared from indii.music</p>
          </header>

          <section className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#070709]/90 p-6 backdrop-blur-md">
            <div className="specular-line-gold pointer-events-none absolute inset-x-0 top-0 h-px opacity-75" />
            <div className="flex items-start gap-3">
              <RightsIcon className={`mt-0.5 h-5 w-5 shrink-0 ${report.rights.status === 'good' ? 'text-[#00FF66]' : 'text-[#FFC107]'}`} aria-hidden="true" />
              <div>
                <h2 className="font-bold">{report.rights.title}</h2>
                <p className="mt-1 text-sm text-white/75">{report.rights.description}</p>
              </div>
            </div>
          </section>

          {report.steps.length > 0 && (
            <section className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#070709]/90 p-6 backdrop-blur-md">
              <div className="specular-line-cyan pointer-events-none absolute inset-x-0 top-0 h-px opacity-60" />
              <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#9AA1B2]">Their next moves</h2>
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

          <section className="space-y-4 rounded-2xl border border-[#FFB800]/25 bg-linear-to-b from-[#FFB800]/10 to-black/60 p-8 text-center shadow-[0_0_50px_rgba(255,184,0,0.08)]">
            <h2 className="text-2xl font-black">Where does your music business stand?</h2>
            <p className="mx-auto max-w-md text-sm text-[#B4B9C7]">Seven questions. A personal gap report on rights, royalties and your next release. Free, no account needed.</p>
            <TakeYoursButton cta="shared_result_take_yours" />
          </section>
        </div>
      </main>
    </div>
  );
}
