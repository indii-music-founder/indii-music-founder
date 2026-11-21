'use client';

import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Disc3,
  Sparkles,
  RotateCcw,
  Download,
} from 'lucide-react';
import {
  type PassportAnswers,
  type DiagnosticReport,
  CAREER_STAGES,
  GENRES,
  PRO_OPTIONS,
  MLC_OPTIONS,
  DISTRIBUTOR_OPTIONS,
  RELEASE_STATUS_OPTIONS,
  GOAL_OPTIONS,
  INITIAL_ANSWERS,
  evaluatePassport,
} from '../lib/passportEvaluator';
import {
  saveProspectAssessment,
  updateAssessmentContact,
  getActiveAssessmentId,
} from '../lib/passportService';
import { trackPassportEvent } from '../lib/passportAnalytics';
import { EASE_OUT_EXPO } from '../lib/motionSystem';
import PassportSharePanel from '../components/passport/PassportSharePanel';
import PassportSingularityHero from '../components/passport/PassportSingularityHero';
import { NOW_WHAT_CAMPAIGNS, readCampaignAttribution, campaignQuery } from '../lib/nowWhatCampaign';
import { detectQualityProfile } from '../three/quality';
import { backdropOpacityForStep } from '../components/passport/horizonMotion';

const PassportSingularityCanvas = lazy(
  () => import('../components/passport/PassportSingularityCanvas'),
);

// --- Main Component ---
export default function ArtistPassportPage() {
  const location = useLocation();

  // Extract referral source from URL search params (e.g. ?source=founder_dm or ?source=meta_ads)
  const searchParams = new URLSearchParams(location.search);
  const acquisitionSource = searchParams.get('source') || 'passport_organic';
  const campaign = readCampaignAttribution(location.search);
  const entry = NOW_WHAT_CAMPAIGNS.find(c => c.id === campaign.entry);
  const referralQuery = campaignQuery(`${location.search}${location.search ? '&' : '?'}source=${encodeURIComponent(acquisitionSource)}`);

  // Step state: 0 = Hero, 1 = Stage, 2 = Genre, 3 = Rights, 4 = Distribution, 5 = Goals, 6 = Results
  const [currentStep, setCurrentStep] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem('indii_passport_step');
      return saved ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });

  const [answers, setAnswers] = useState<PassportAnswers>(() => {
    try {
      const saved = sessionStorage.getItem('indii_passport_draft');
      return saved ? JSON.parse(saved) : INITIAL_ANSWERS;
    } catch {
      return INITIAL_ANSWERS;
    }
  });

  // Optional contact capture state
  const [artistName, setArtistName] = useState('');
  const [email, setEmail] = useState('');
  const [assessmentConsent, setAssessmentConsent] = useState(true);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadError, setLeadError] = useState('');
  const [leadPending, setLeadPending] = useState(false);
  const [assessmentId, setAssessmentId] = useState<string>(() => {
    try {
      return getActiveAssessmentId() || '';
    } catch {
      return '';
    }
  });

  const completionTracked = useRef(false);
  const ctaAnchorRef = useRef<HTMLDivElement | null>(null);
  const [qualityProfile] = useState(() => detectQualityProfile());
  const [horizonPaused, setHorizonPaused] = useState(() => qualityProfile.tier === 'FALLBACK');
  const [pullActive, setPullActive] = useState(false);
  const [warping, setWarping] = useState(false);
  const [focalPoint, setFocalPoint] = useState({ x: 0.5, y: 0.55 });

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Artist Passport | indii.music';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const syncFocalPoint = useCallback(() => {
    if (currentStep !== 0 || !ctaAnchorRef.current) return;
    const rect = ctaAnchorRef.current.getBoundingClientRect();
    const vw = window.innerWidth || 1440;
    const vh = window.innerHeight || 900;
    if (rect.width === 0 || rect.height === 0) return;
    setFocalPoint({
      x: Math.max(0.2, Math.min(0.8, (rect.left + rect.width / 2) / vw)),
      y: Math.max(0.25, Math.min(0.8, (rect.top + rect.height / 2) / vh)),
    });
  }, [currentStep]);

  useEffect(() => {
    syncFocalPoint();
    window.addEventListener('resize', syncFocalPoint, { passive: true });
    return () => window.removeEventListener('resize', syncFocalPoint);
  }, [syncFocalPoint]);

  useEffect(() => {
    if (!warping) return;
    const timer = window.setTimeout(() => setWarping(false), 520);
    return () => window.clearTimeout(timer);
  }, [warping]);

  // Funnel Telemetry: Track page arrival
  useEffect(() => {
    trackPassportEvent('passport_viewed', {
      source: acquisitionSource,
      initialStep: currentStep,
    });
  // Record arrival once per campaign URL, not every wizard step.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Sync to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem('indii_passport_draft', JSON.stringify(answers));
      sessionStorage.setItem('indii_passport_step', String(currentStep));
    } catch {
      // Storage access blocked or unavailable
    }
  }, [answers, currentStep]);

  // Persist assessment to Firestore when entering Step 6 (diagnostic report)
  useEffect(() => {
    if (currentStep === 6 && answers.careerStage && answers.genre && !completionTracked.current) {
      completionTracked.current = true;
      trackPassportEvent('passport_completed', {
        careerStage: answers.careerStage,
        genre: answers.genre,
        proAffiliation: answers.proAffiliation,
        mlcRegistered: answers.mlcRegistered,
        distributor: answers.distributor,
        releaseStatus: answers.releaseStatus,
        goalsCount: answers.goals.length,
      }, assessmentId);

      void saveProspectAssessment(answers, {
        source: acquisitionSource,
        campaign: readCampaignAttribution(location.search),
        artistName: artistName || undefined,
        email: email || undefined,
        marketingConsent: marketingOptIn,
        assessmentConsent,
      }).then((id) => {
        if (id) setAssessmentId(id);
      });
    }
  }, [currentStep, answers, acquisitionSource, artistName, email, marketingOptIn, assessmentConsent, assessmentId, location.search]);

  const handleStart = () => {
    trackPassportEvent('passport_started', { source: acquisitionSource });
    setPullActive(false);
    if (!horizonPaused) setWarping(true);
    setCurrentStep(1);
  };

  const handleNextStep = () => {
    const stepNames = ['hero', 'stage', 'genre', 'rights', 'distribution', 'goals'];
    trackPassportEvent('passport_step_completed', {
      stepIndex: currentStep,
      stepName: stepNames[currentStep] || `step_${currentStep}`,
    }, assessmentId);
    setCurrentStep((prev) => prev + 1);
  };

  const handleGoalToggle = (goalId: string) => {
    setAnswers((prev) => {
      const current = prev.goals;
      if (current.includes(goalId)) {
        return { ...prev, goals: current.filter((g) => g !== goalId) };
      }
      return current.length < 2 ? { ...prev, goals: [...current, goalId] } : prev;
    });
  };

  const handleDownloadReport = () => {
    trackPassportEvent('report_downloaded', { format: 'pdf' }, assessmentId);
    window.print();
  };

  const handleReset = () => {
    completionTracked.current = false;
    setAnswers(INITIAL_ANSWERS);
    setCurrentStep(0);
    setArtistName('');
    setEmail('');
    setLeadSubmitted(false);
    setLeadError('');
    setAssessmentId('');
    try {
      sessionStorage.removeItem('indii_passport_draft');
      sessionStorage.removeItem('indii_passport_step');
      sessionStorage.removeItem('indii_passport_id');
    } catch {
      // Ignore
    }
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return Boolean(answers.careerStage);
      case 2:
        return Boolean(answers.genre);
      case 3:
        return Boolean(answers.proAffiliation && answers.mlcRegistered);
      case 4:
        return Boolean(answers.distributor && answers.releaseStatus);
      case 5:
        return answers.goals.length > 0 && answers.goals.length <= 2;
      default:
        return true;
    }
  };

  const diagnosticReport: DiagnosticReport = evaluatePassport(answers);

  // Steps slide in from the direction of travel; the previous step is read
  // during render, so it still holds the step we are leaving.
  const prevStepRef = useRef(currentStep);
  const stepDirection = currentStep >= prevStepRef.current ? 1 : -1;
  useEffect(() => {
    prevStepRef.current = currentStep;
  }, [currentStep]);
  const stepEnter = {
    initial: { opacity: 0, x: stepDirection * 28, filter: 'blur(6px)' },
    animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
  };
  const progress = currentStep >= 6 ? 1 : Math.max(0, currentStep) / 5;

  return (
    <div className="min-h-screen bg-[#000000] text-white selection:bg-[#FFB800] selection:text-black antialiased relative overflow-hidden flex flex-col justify-between">
      {/* Bespoke Black Hole Singularity Backdrop (instant LCP + static FALLBACK) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-700 no-print"
        style={{ opacity: backdropOpacityForStep(currentStep) }}
      >
        <img
          src="/images/passport-singularity.jpg"
          alt=""
          className={`h-full w-full object-cover object-center transition-transform duration-700 ${
            pullActive && !horizonPaused ? 'scale-[1.06]' : 'scale-100'
          }`}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.68)_42%,#000000_82%)]" />
      </div>

      {/* Real-time Three.js / GLSL Singularity Accretion & Gravitational Particle Engine */}
      {qualityProfile.tier !== 'FALLBACK' && (
        <Suspense fallback={null}>
          <PassportSingularityCanvas
            tier={qualityProfile.tier}
            paused={horizonPaused}
            pullActive={pullActive}
            warping={warping}
            step={currentStep}
            focalPoint={focalPoint}
          />
        </Suspense>
      )}

      {/* Header Bar */}
      <header className="relative z-20 border-b border-white/10 bg-[#000000]/70 backdrop-blur-md px-6 py-4 no-print">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-xl font-bold tracking-tight text-white hover:text-[#FFB800] transition-colors">
              indii<span className="text-[#FFB800]">.music</span>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-white/15 bg-black/75 text-[10px] font-mono uppercase tracking-widest text-[#B4B9C7]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FFB800] animate-pulse" />
              Artist Passport
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            {currentStep > 0 && currentStep <= 5 && (
              <span className="text-[#9AA1B2]">
                STEP <span className="text-white font-bold">{`0${currentStep}`}</span> / 05
              </span>
            )}
            <Link
              to={`/login${referralQuery}`}
              className="text-[#B4B9C7] hover:text-white transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
        {currentStep > 0 && (
          <div aria-hidden="true" className="absolute inset-x-0 -bottom-px h-px bg-white/10">
            <motion.div
              className="h-full origin-left bg-gradient-to-r from-[#FFB800] via-[#FFD56B] to-[#00F0FF]"
              initial={false}
              animate={{ scaleX: progress }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
            />
          </div>
        )}
      </header>

      {/* Main Diagnostic Body */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full flex-1 flex flex-col justify-center">
        {/* STEP 0: HERO ARRIVAL (EVENT HORIZON SINGULARITY) */}
        {currentStep === 0 && (
          <PassportSingularityHero
            entry={entry}
            referralQuery={referralQuery}
            motionPaused={horizonPaused}
            onToggleMotion={() => setHorizonPaused((prev) => !prev)}
            onPullChange={setPullActive}
            onStart={handleStart}
            onExploreGuide={() => trackPassportEvent('freebie_clicked', { cta: 'hero_platform_guide' })}
            onAnchorElement={(el) => {
              ctaAnchorRef.current = el;
            }}
          />
        )}

          {/* STEP 1: CAREER STAGE */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              data-passport-step
              {...stepEnter}
              className="space-y-6"
            >
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-[#FFB800]">
                  Section 01 / Career Stage
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                  Where are you currently in your music journey?
                </h2>
                <p className="text-sm text-[#8A8F9E] mt-1">
                  Your answers help us suggest the right next step for this stage of your career.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {CAREER_STAGES.map((stage) => {
                  const selected = answers.careerStage === stage.id;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setAnswers((prev) => ({ ...prev, careerStage: stage.id }))}
                      className={`text-left p-5 rounded-xl border transition-all ${
                        selected
                          ? 'border-[#FFB800] bg-[#FFB800]/5 shadow-[0_0_20px_rgba(255,184,0,0.15)] ring-1 ring-[#FFB800]'
                          : 'border-[#1F222A] bg-[#070709] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#8A8F9E] tracking-wider">{stage.badge}</span>
                        {selected && <CheckCircle2 className="w-4 h-4 text-[#FFB800]" />}
                      </div>
                      <div className="text-base font-bold text-white mt-2">{stage.title}</div>
                      <p className="text-xs text-[#8A8F9E] mt-1 leading-relaxed">{stage.desc}</p>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 2: PRIMARY GENRE */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              data-passport-step
              {...stepEnter}
              className="space-y-6"
            >
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-[#FFB800]">
                  Section 02 / Musical Focus
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                  What is your primary musical lane?
                </h2>
                <p className="text-sm text-[#8A8F9E] mt-1">
                  Genre shapes collaborator split patterns, licensing windows, and audio mastering norms.
                </p>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {GENRES.map((g) => {
                  const selected = answers.genre === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setAnswers((prev) => ({ ...prev, genre: g.id }))}
                      className={`text-left px-4 py-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        selected
                          ? 'border-[#FFB800] bg-[#FFB800]/5 text-white ring-1 ring-[#FFB800]'
                          : 'border-[#1F222A] bg-[#070709] text-[#8A8F9E] hover:text-white hover:border-white/20'
                      }`}
                    >
                      <span className="text-sm font-semibold">{g.label}</span>
                      {selected && <CheckCircle2 className="w-4 h-4 text-[#FFB800]" />}
                    </button>
                  );
                })}
              </div>

              {answers.genre === 'Other' && (
                <div className="space-y-2">
                  <label htmlFor="passport-custom-genre" className="text-xs font-mono uppercase tracking-wider text-white block">
                    Describe your sound
                  </label>
                  <input
                    id="passport-custom-genre"
                    type="text"
                    maxLength={80}
                    value={answers.customGenre ?? ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, customGenre: e.target.value }))}
                    placeholder="e.g. Detroit ghettotech, shoegaze-gospel, bossa nova"
                    className="w-full px-4 py-3 rounded-xl border border-[#1F222A] bg-[#070709] text-sm text-white placeholder:text-[#8A8F9E]/60 focus:outline-none focus:border-[#FFB800] focus:ring-1 focus:ring-[#FFB800]"
                  />
                </div>
              )}

              <p className="text-[11px] text-[#8A8F9E] leading-relaxed italic border-t border-[#1F222A] pt-4">
                Note: Human-made electronic, dance, and hip-hop music utilizing legitimately licensed samples, loops, and
                sound libraries is fully recognized and celebrated as human-created music.
              </p>
            </motion.div>
          )}

          {/* STEP 3: RIGHTS & REGISTRATIONS */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              data-passport-step
              {...stepEnter}
              className="space-y-6"
            >
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-[#FFB800]">
                  Section 03 / Rights & Royalties
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                  How are your songs registered?
                </h2>
                <p className="text-sm text-[#8A8F9E] mt-1">
                  In the US and global markets, performance royalties and digital streaming mechanicals flow through
                  different collection pipelines.
                </p>
              </div>

              {/* 3A PRO */}
              <div className="space-y-2.5">
                <label className="text-xs font-mono uppercase tracking-wider text-white block">
                  3A. Performing Rights Organization (PRO)
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PRO_OPTIONS.map((pro) => {
                    const selected = answers.proAffiliation === pro.id;
                    return (
                      <button
                        key={pro.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setAnswers((prev) => ({ ...prev, proAffiliation: pro.id }))}
                        className={`text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center justify-between ${
                          selected
                            ? 'border-[#FFB800] bg-[#FFB800]/5 text-white ring-1 ring-[#FFB800]'
                            : 'border-[#1F222A] bg-[#070709] text-[#8A8F9E] hover:text-white hover:border-white/20'
                        }`}
                      >
                        <span>{pro.label}</span>
                        {selected && <CheckCircle2 className="w-4 h-4 text-[#FFB800]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3B MLC */}
              <div className="space-y-2.5 pt-4 border-t border-[#1F222A]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase tracking-wider text-white block">
                    3B. The MLC (Mechanical Licensing Collective)
                  </label>
                  <span className="text-[10px] font-mono text-[#FFB800] bg-[#FFB800]/10 px-2 py-0.5 rounded">
                    US Streaming Mechanicals
                  </span>
                </div>
                <p className="text-xs text-[#8A8F9E]">
                  Are your eligible compositions registered with The MLC to collect US interactive streaming
                  mechanicals?
                </p>
                <div className="grid gap-2">
                  {MLC_OPTIONS.map((mlc) => {
                    const selected = answers.mlcRegistered === mlc.id;
                    return (
                      <button
                        key={mlc.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setAnswers((prev) => ({ ...prev, mlcRegistered: mlc.id }))}
                        className={`text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center justify-between ${
                          selected
                            ? 'border-[#FFB800] bg-[#FFB800]/5 text-white ring-1 ring-[#FFB800]'
                            : 'border-[#1F222A] bg-[#070709] text-[#8A8F9E] hover:text-white hover:border-white/20'
                        }`}
                      >
                        <span>{mlc.label}</span>
                        {selected && <CheckCircle2 className="w-4 h-4 text-[#FFB800]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: DISTRIBUTION & RELEASE */}
          {currentStep === 4 && (
            <motion.div
              key="step-4"
              data-passport-step
              {...stepEnter}
              className="space-y-6"
            >
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-[#FFB800]">
                  Section 04 / Distribution & Releases
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                  How is your music distributed?
                </h2>
                <p className="text-sm text-[#8A8F9E] mt-1">
                  Distributor standards dictate metadata accuracy, ISRC assignment, and release lead times.
                </p>
              </div>

              {/* 4A Distributor */}
              <div className="space-y-2.5">
                <label className="text-xs font-mono uppercase tracking-wider text-white block">
                  4A. Primary Distributor
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DISTRIBUTOR_OPTIONS.map((dist) => {
                    const selected = answers.distributor === dist.id;
                    return (
                      <button
                        key={dist.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setAnswers((prev) => ({ ...prev, distributor: dist.id }))}
                        className={`text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center justify-between ${
                          selected
                            ? 'border-[#FFB800] bg-[#FFB800]/5 text-white ring-1 ring-[#FFB800]'
                            : 'border-[#1F222A] bg-[#070709] text-[#8A8F9E] hover:text-white hover:border-white/20'
                        }`}
                      >
                        <span>{dist.label}</span>
                        {selected && <CheckCircle2 className="w-4 h-4 text-[#FFB800]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4B Next Release Status */}
              <div className="space-y-2.5 pt-4 border-t border-[#1F222A]">
                <label className="text-xs font-mono uppercase tracking-wider text-white block">
                  4B. Where is your next release?
                </label>
                <div className="grid gap-2">
                  {RELEASE_STATUS_OPTIONS.map((rel) => {
                    const selected = answers.releaseStatus === rel.id;
                    return (
                      <button
                        key={rel.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setAnswers((prev) => ({ ...prev, releaseStatus: rel.id }))}
                        className={`text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center justify-between ${
                          selected
                            ? 'border-[#FFB800] bg-[#FFB800]/5 text-white ring-1 ring-[#FFB800]'
                            : 'border-[#1F222A] bg-[#070709] text-[#8A8F9E] hover:text-white hover:border-white/20'
                        }`}
                      >
                        <span>{rel.label}</span>
                        {selected && <CheckCircle2 className="w-4 h-4 text-[#FFB800]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 5: BUSINESS PRIORITIES */}
          {currentStep === 5 && (
            <motion.div
              key="step-5"
              data-passport-step
              {...stepEnter}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-mono uppercase tracking-widest text-[#FFB800]">
                    Section 05 / Immediate Priorities
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                    What areas of your music business do you want covered?
                  </h2>
                  <p className="text-sm text-[#8A8F9E] mt-1">
                    Choose your top two priorities. You can revisit other areas as your music business develops.
                  </p>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#070709] border border-[#1F222A] text-[#8A8F9E] whitespace-nowrap self-start sm:self-auto">
                  {answers.goals.length === 0 ? 'Select up to 2' : `${answers.goals.length} Selected`}
                </span>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {GOAL_OPTIONS.map((goal) => {
                  const selected = answers.goals.includes(goal.id);
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleGoalToggle(goal.id)}
                      className={`text-left px-4 py-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        selected
                          ? 'border-[#FFB800] bg-[#FFB800]/5 text-white ring-1 ring-[#FFB800]'
                          : 'border-[#1F222A] bg-[#070709] text-[#8A8F9E] hover:text-white hover:border-white/20'
                      }`}
                    >
                      <span className="text-sm font-semibold">{goal.label}</span>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-3 transition-colors ${
                          selected ? 'border-[#FFB800] bg-[#FFB800]' : 'border-white/20'
                        }`}
                      >
                        {selected && <CheckCircle2 className="w-3 h-3 text-black" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 6: GAP REPORT & ACTIONABLE VALUE */}
          {currentStep === 6 && (
            <motion.div
              key="step-6"
              data-passport-report
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
              className="space-y-8"
            >
              {/* Header Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F222A] pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="passport-ping h-2 w-2 rounded-full bg-[#00FF66] shadow-[0_0_8px_#00FF66]" />
                    <span className="text-xs font-mono uppercase tracking-widest text-[#00FF66]">
                      Audit Complete • Personalized Gap Analysis
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                    Your Artist Business Diagnostic
                  </h2>
                  <p className="text-sm text-[#8A8F9E] mt-0.5">
                    Profile: {answers.genre === 'Other' && answers.customGenre?.trim() ? answers.customGenre.trim() : answers.genre} • {answers.careerStage}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadReport}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono text-white bg-white/10 hover:bg-white/20 border border-white/10 hover:border-[#FFB800]/50 transition-all no-print"
                  >
                    <Download className="w-3.5 h-3.5 text-[#FFB800]" />
                    <span>Download Report (PDF)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8A8F9E] hover:text-white transition-colors no-print"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Start Over</span>
                  </button>
                </div>
              </div>

              {entry && <aside className="rounded-xl border border-[#FFB800]/30 p-5"><h2 className="font-bold text-[#FFB800]">{entry.hook}</h2><p className="mt-2 text-sm text-white/70">{entry.answer} Your personalized priorities below come from your answers.</p></aside>}

              {/* 3. Top 3 Actionable Next Steps */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[#070709] border border-[#1F222A] space-y-6">
                <div>
                  <span className="text-xs font-mono uppercase tracking-widest text-[#FFB800]">
                    Your 3-Step Immediate Roadmap
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">Recommended Next Actions</h3>
                  <p className="text-xs text-[#8A8F9E] mt-0.5">
                    Now what? Start with your selected priorities, then review the next relevant business task.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {diagnosticReport.steps.map((st) => (
                    <div key={st.stepNumber} className="p-4 rounded-xl bg-black/60 border border-[#1F222A] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-[#FFB800]">{`STEP 0${st.stepNumber}`}</span>
                        <span
                          className="text-[9px] font-mono px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: `${st.departmentColor}15`,
                            color: st.departmentColor,
                            border: `1px solid ${st.departmentColor}30`,
                          }}
                        >
                          {st.department}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white">{st.title}</div>
                      <p className="text-[11px] text-[#8A8F9E] leading-relaxed">{st.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diagnostic Cards Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* 1. Rights & Royalties Card */}
                <div className="p-6 rounded-2xl bg-[#070709] border border-[#1F222A] flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#FFC107]">
                        Rights & Royalties Health
                      </span>
                      {diagnosticReport.rights.status === 'warning' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-[#FFC107] bg-[#FFC107]/10 border border-[#FFC107]/30">
                          <AlertTriangle className="w-3 h-3" />
                          Collection Gap
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-[#00FF66] bg-[#00FF66]/10 border border-[#00FF66]/30">
                          <ShieldCheck className="w-3 h-3" />
                          Foundation Solid
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white mt-3">{diagnosticReport.rights.title}</h3>
                    <p className="text-xs text-[#8A8F9E] mt-2 leading-relaxed">
                      {diagnosticReport.rights.description}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-black/60 border border-white/5 text-xs text-white/90 leading-relaxed">
                    <span className="font-mono text-[10px] text-[#FFB800] uppercase block mb-1">Observation</span>
                    {diagnosticReport.rights.actionRecommendation}
                  </div>
                </div>

                {/* 2. Release & Technical Readiness */}
                <div className="p-6 rounded-2xl bg-[#070709] border border-[#1F222A] flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#2196F3]">
                        Release & Sonic Readiness
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-[#2196F3] bg-[#2196F3]/10 border border-[#2196F3]/30">
                        <Disc3 className="w-3 h-3" />
                        Technical Specs
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-3">{diagnosticReport.release.title}</h3>
                    <ul className="text-xs text-[#8A8F9E] mt-3 space-y-2">
                      {diagnosticReport.release.guidelines.map((guide, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-[#2196F3] mt-0.5">•</span>
                          <span className="leading-relaxed">{guide}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-black/60 border border-white/5 text-xs text-white/90">
                    <span className="font-mono text-[10px] text-[#2196F3] uppercase block mb-1">
                      Distributor Delivery
                    </span>
                    Connected with {answers.distributor || 'independent channels'}.
                  </div>
                </div>
              </div>

              <PassportSharePanel answers={answers} assessmentId={assessmentId} />

              {/* 5. Lead Capture & Account Creation Handoff */}
              <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-[#0e0e12] to-[#070709] border border-[#FFB800]/30 shadow-[0_0_35px_rgba(255,184,0,0.1)] space-y-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00FF66]/30 bg-[#00FF66]/10 text-[11px] font-mono text-[#00FF66] uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-[#00FF66]" />
                    <span>Instant Artist Bonus • Free 9:16 Video Campaign</span>
                  </div>
                  <h3 className="text-2xl font-black text-white">
                    Claim Your Artist Passport & Free 9:16 Video Campaign
                  </h3>
                  <p className="text-sm text-[#8A8F9E] leading-relaxed max-w-2xl">
                    Your answers are saved in this session. Request an email summary of your assessment, or print this page to save a PDF. Continue into indii.music to explore the relevant workflows; Studio access follows the current beta availability.
                  </p>
                </div>

                {/* Optional Email Capture */}
                {!leadSubmitted ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setLeadError('');
                      setLeadPending(true);
                      try {
                        const id = assessmentId || await saveProspectAssessment(answers, {
                          source: acquisitionSource,
                          campaign: readCampaignAttribution(location.search),
                        });
                        await updateAssessmentContact(id, {
                          artistName: artistName || undefined,
                          email: email || undefined,
                          marketingConsent: marketingOptIn,
                          assessmentConsent,
                        });
                        setAssessmentId(id);
                        setLeadSubmitted(true);
                        trackPassportEvent('lead_submitted', {
                          hasName: Boolean(artistName), hasEmail: Boolean(email),
                          marketingOptIn, assessmentConsent,
                        }, id);
                      } catch (error) {
                        setLeadError(error instanceof Error ? error.message : 'Unable to save your request. Please try again.');
                      } finally {
                        setLeadPending(false);
                      }
                    }}
                    className="space-y-4 max-w-lg"
                  >
                    {leadError && <p role="alert" className="text-sm text-red-300">{leadError}</p>}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-[11px] font-mono text-[#8A8F9E] block mb-1">
                          Artist / Project Name
                        </label>
                        <input
                          type="text"
                          value={artistName}
                          onChange={(e) => setArtistName(e.target.value)}
                          placeholder="e.g. Luna Eclipse"
                          className="w-full px-3.5 py-2.5 rounded-lg bg-black border border-[#1F222A] text-sm text-white placeholder-white/30 focus:border-[#FFB800] focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-mono text-[#8A8F9E] block mb-1">Email Address</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="artist@example.com"
                          className="w-full px-3.5 py-2.5 rounded-lg bg-black border border-[#1F222A] text-sm text-white placeholder-white/30 focus:border-[#FFB800] focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-[#8A8F9E]">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assessmentConsent}
                          onChange={(e) => setAssessmentConsent(e.target.checked)}
                          className="mt-0.5 rounded border-white/20 text-[#FFB800] focus:ring-[#FFB800]"
                        />
                        <span>Send me an email summary of my Artist Passport assessment.</span>
                      </label>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={marketingOptIn}
                          onChange={(e) => setMarketingOptIn(e.target.checked)}
                          className="mt-0.5 rounded border-white/20 text-[#FFB800] focus:ring-[#FFB800]"
                        />
                        <span>Unlock 1 free 9:16 vertical video campaign render & early studio access invitations.</span>
                      </label>
                    </div>

                    {email && (
                      <button
                        type="submit"
                        disabled={leadPending}
                        className="text-xs font-mono font-bold px-4 py-2.5 rounded-lg bg-[#FFB800] hover:bg-[#FFD700] text-black transition-all shadow-[0_0_15px_rgba(255,184,0,0.2)]"
                      >
                        {leadPending ? 'Saving request…' : 'Request my assessment summary'}
                      </button>
                    )}
                  </form>
                ) : (
                  <div className="p-4 rounded-xl bg-black/60 border border-[#00FF66]/30 text-xs text-[#00FF66] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Your assessment copy request is saved for {email}, and your Free 9:16 Video Campaign test drive is unlocked!</span>
                  </div>
                )}

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-white/10 no-print">
                  <Link
                    to={`/signup${referralQuery}${assessmentId ? `&assessmentId=${encodeURIComponent(assessmentId)}` : ''}`}
                    onClick={() => trackPassportEvent('signup_clicked', { cta: 'claim_passport' }, assessmentId)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-black text-black bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#E65100] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_28px_rgba(255,184,0,0.4)]"
                  >
                    <span>Claim Your Artist Passport & Enter Studio</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    to={`/${referralQuery}${assessmentId ? `&assessmentId=${encodeURIComponent(assessmentId)}` : ''}#waitlist`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    <span>Join Founding Artist Waitlist</span>
                  </Link>
                </div>

                <div className="text-[11px] text-[#8A8F9E] leading-relaxed no-print">
                  Artist Passport is a pre-membership diagnostic. Official studio membership and tools are governed by the{' '}
                  <Link to="/terms" className="underline hover:text-white">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="underline hover:text-white">
                    Privacy Policy
                  </Link>
                  .
                </div>
              </div>

              {/* 5. Quiet pointer to the product tour (replaces the old wiki promo block) */}
              <p className="text-center text-sm text-[#8A8F9E] no-print">
                Want to see the studio first?{' '}
                <Link
                  to={`/${referralQuery}${referralQuery.includes('?') ? '&' : '?'}from=passport${assessmentId ? `&assessmentId=${encodeURIComponent(assessmentId)}` : ''}#studio-preview`}
                  onClick={() => trackPassportEvent('freebie_clicked', { cta: 'platform_wiki_explored' }, assessmentId)}
                  className="font-semibold text-white underline decoration-[#FFB800]/60 underline-offset-4 transition-colors hover:text-[#FFB800]"
                >
                  See how indii.music works
                </Link>
                . No sign-up needed.
              </p>
            </motion.div>
          )}

        {/* Stepper Navigation Footer */}
        {currentStep >= 1 && currentStep <= 5 && (
          <div className="mt-8 pt-6 border-t border-[#1F222A] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono text-[#8A8F9E] hover:text-white bg-[#070709] border border-[#1F222A] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              disabled={!isStepValid(currentStep)}
              onClick={handleNextStep}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-mono font-bold text-black bg-[#FFB800] hover:bg-[#FFD700] disabled:opacity-40 disabled:hover:bg-[#FFB800] transition-all shadow-[0_0_15px_rgba(255,184,0,0.25)]"
            >
              <span>{currentStep === 5 ? 'Generate Assessment' : 'Next Step'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="relative z-20 border-t border-white/10 bg-[#000000]/75 backdrop-blur-md px-6 py-5 text-center text-xs text-[#9AA1B2] no-print">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">indii.music</span>
            <span>—</span>
            <span className="italic">music business at the speed of you</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link to={`/signup${referralQuery}`} className="text-[#FFB800] hover:underline">
              Create Account
            </Link>
          </div>
        </div>
      </footer>

      {/* Print styles for PDF report export */}
      <style>{`
        @media print {
          header, footer, nav, button, .no-print {
            display: none !important;
          }
          body, main {
            background-color: #000000 !important;
            color: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
