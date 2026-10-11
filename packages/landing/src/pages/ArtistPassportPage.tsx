'use client';

import React, { useState, useEffect } from 'react';
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

// --- Main Component ---
export default function ArtistPassportPage() {
  const location = useLocation();

  // Extract referral source from URL search params (e.g. ?source=founder_dm or ?source=meta_ads)
  const searchParams = new URLSearchParams(location.search);
  const acquisitionSource = searchParams.get('source') || 'passport_organic';
  const referralQuery = `?source=${encodeURIComponent(acquisitionSource)}`;

  // Studio destination for free mini-campaign trial
  const studioBase =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:4242'
      : (import.meta.env.VITE_STUDIO_URL || 'https://app.indii.music');

  const freeMiniCampaignUrl = `${studioBase}?mode=free_demo&module=creative${acquisitionSource ? `&source=${encodeURIComponent(acquisitionSource)}` : ''}`;

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
  const [assessmentId, setAssessmentId] = useState<string>(() => {
    try {
      return getActiveAssessmentId() || '';
    } catch {
      return '';
    }
  });

  // Funnel Telemetry: Track page arrival
  useEffect(() => {
    trackPassportEvent('passport_viewed', {
      source: acquisitionSource,
      initialStep: currentStep,
    });
  }, [acquisitionSource, currentStep]);

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
    if (currentStep === 6 && answers.careerStage && answers.genre) {
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
        artistName: artistName || undefined,
        email: email || undefined,
        marketingConsent: marketingOptIn,
        assessmentConsent,
      }).then((id) => {
        if (id) setAssessmentId(id);
      });
    }
  }, [currentStep, answers, acquisitionSource, artistName, email, marketingOptIn, assessmentConsent, assessmentId]);

  const handleStart = () => {
    trackPassportEvent('passport_started', { source: acquisitionSource });
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
      if (current.length >= 2) {
        // Replace second choice or enforce max 2
        return { ...prev, goals: [current[0], goalId] };
      }
      return { ...prev, goals: [...current, goalId] };
    });
  };

  const handleReset = () => {
    setAnswers(INITIAL_ANSWERS);
    setCurrentStep(0);
    setArtistName('');
    setEmail('');
    setLeadSubmitted(false);
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
        return answers.goals.length > 0;
      default:
        return true;
    }
  };

  const diagnosticReport: DiagnosticReport = evaluatePassport(answers);

  return (
    <div className="min-h-screen bg-[#000000] text-white selection:bg-[#FFB800] selection:text-black antialiased relative overflow-hidden flex flex-col justify-between">
      {/* Background Ambience */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,184,0,0.06),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,rgba(46,46,254,0.04),transparent_50%)]" />

      {/* Header Bar */}
      <header className="relative z-20 border-b border-[#1F222A] bg-[#000000]/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-xl font-bold tracking-tight text-white hover:text-[#FFB800] transition-colors">
              indii<span className="text-[#FFB800]">.music</span>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-white/10 bg-[#070709] text-[10px] font-mono uppercase tracking-widest text-[#8A8F9E]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FFB800] animate-pulse" />
              Artist Passport
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            {currentStep > 0 && currentStep <= 5 && (
              <span className="text-[#8A8F9E]">
                STEP <span className="text-white font-bold">{`0${currentStep}`}</span> / 05
              </span>
            )}
            <Link
              to={`/login${referralQuery}`}
              className="text-[#8A8F9E] hover:text-white transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Diagnostic Body */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full flex-1 flex flex-col justify-center">
        {/* STEP 0: HERO ARRIVAL */}
        {currentStep === 0 && (
          <motion.div
            key="step-0"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-center max-w-2xl mx-auto space-y-6"
          >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#FFB800]/30 bg-[#FFB800]/10 text-xs font-mono tracking-wide text-[#FFB800]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>People make the music, indii makes the business.</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                How ready is your music <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/60">
                  for business?
                </span>
              </h1>

              <p className="text-base sm:text-lg text-[#8A8F9E] leading-relaxed">
                Find potential gaps in your mechanical royalty registrations, release preparation, and business
                operations in about two minutes.
              </p>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={handleStart}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-black text-black bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#E65100] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_24px_rgba(255,184,0,0.35)]"
                >
                  <span>Start Free Business Audit</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <a
                  href={freeMiniCampaignUrl}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#FFB800]/40 transition-all"
                >
                  <span>Or Test Drive 1 Track Free</span>
                  <Sparkles className="w-4 h-4 text-[#FFB800]" />
                </a>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-8 border-t border-[#1F222A] text-left">
                <div className="p-3 rounded-lg bg-[#070709] border border-[#1F222A]">
                  <div className="text-[11px] font-mono text-[#8A8F9E] uppercase tracking-wider">Fast & Focused</div>
                  <div className="text-xs font-semibold text-white mt-1">2-Minute Diagnostic</div>
                </div>
                <div className="p-3 rounded-lg bg-[#070709] border border-[#1F222A]">
                  <div className="text-[11px] font-mono text-[#8A8F9E] uppercase tracking-wider">Value First</div>
                  <div className="text-xs font-semibold text-white mt-1">Free Mini-Campaign</div>
                </div>
                <div className="p-3 rounded-lg bg-[#070709] border border-[#1F222A]">
                  <div className="text-[11px] font-mono text-[#8A8F9E] uppercase tracking-wider">Zero Slop</div>
                  <div className="text-xs font-semibold text-white mt-1">100% Human Music</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 1: CAREER STAGE */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
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
                  We calibrate recommendations based on your operational complexity.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {CAREER_STAGES.map((stage) => {
                  const selected = answers.careerStage === stage.id;
                  return (
                    <button
                      key={stage.id}
                      type="button"
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono uppercase tracking-widest text-[#FFB800]">
                    Section 05 / Immediate Priorities
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                    What are your top 2 priorities right now?
                  </h2>
                  <p className="text-sm text-[#8A8F9E] mt-1">
                    Select up to two areas where you want focused operational support.
                  </p>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#070709] border border-[#1F222A] text-[#8A8F9E]">
                  {answers.goals.length}/2 Selected
                </span>
              </div>

              <div className="grid gap-2.5">
                {GOAL_OPTIONS.map((goal) => {
                  const selected = answers.goals.includes(goal.id);
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => handleGoalToggle(goal.id)}
                      className={`text-left px-4 py-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        selected
                          ? 'border-[#FFB800] bg-[#FFB800]/5 text-white ring-1 ring-[#FFB800]'
                          : 'border-[#1F222A] bg-[#070709] text-[#8A8F9E] hover:text-white hover:border-white/20'
                      }`}
                    >
                      <span className="text-sm font-semibold">{goal.label}</span>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
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
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              {/* Header Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F222A] pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#00FF66] shadow-[0_0_8px_#00FF66]" />
                    <span className="text-xs font-mono uppercase tracking-widest text-[#00FF66]">
                      Audit Complete • Personalized Gap Analysis
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                    Your Artist Business Diagnostic
                  </h2>
                  <p className="text-sm text-[#8A8F9E] mt-0.5">
                    Profile: {answers.genre} • {answers.careerStage}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8A8F9E] hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Start Over</span>
                </button>
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

              {/* 3. Top 3 Actionable Next Steps */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[#070709] border border-[#1F222A] space-y-6">
                <div>
                  <span className="text-xs font-mono uppercase tracking-widest text-[#FFB800]">
                    Your 3-Step Immediate Roadmap
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">Recommended Next Actions</h3>
                  <p className="text-xs text-[#8A8F9E] mt-0.5">
                    Tailored to your career stage and selected business goals.
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

              {/* 4. How indii.music Helps */}
              <div className="p-6 rounded-2xl bg-[#070709] border border-[#1F222A] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-white/70">
                      The indii Virtual Team
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1">How Your Specialist Team Executes This</h3>
                  </div>
                  <span className="text-xs font-mono text-[#FFB800] bg-[#FFB800]/10 px-2.5 py-1 rounded">
                    23 Domain Specialists
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                  {diagnosticReport.matchedSpecialists.map((spec) => (
                    <div key={spec.name} className="p-3.5 rounded-xl bg-black/50 border border-white/5 space-y-1">
                      <div className="text-xs font-bold text-white" style={{ color: spec.color }}>
                        {spec.name}
                      </div>
                      <div className="text-[11px] text-[#8A8F9E]">{spec.role}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Lead Capture & Account Creation Handoff */}
              <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-[#0e0e12] to-[#070709] border border-[#FFB800]/30 shadow-[0_0_35px_rgba(255,184,0,0.1)] space-y-6">
                <div>
                  <h3 className="text-2xl font-black text-white">Claim Your Artist Passport</h3>
                  <p className="text-sm text-[#8A8F9E] mt-1">
                    Your assessment answers are saved in your current session. Continue to indii.music to start running
                    your music business in one connected studio.
                  </p>
                </div>

                {/* Optional Email Capture */}
                {!leadSubmitted ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setLeadSubmitted(true);
                      trackPassportEvent('lead_submitted', {
                        hasName: Boolean(artistName),
                        hasEmail: Boolean(email),
                        marketingOptIn,
                        assessmentConsent,
                      }, assessmentId);
                      if (assessmentId) {
                        await updateAssessmentContact(assessmentId, {
                          artistName: artistName || undefined,
                          email: email || undefined,
                          marketingConsent: marketingOptIn,
                          assessmentConsent,
                        });
                      } else {
                        const id = await saveProspectAssessment(answers, {
                          source: acquisitionSource,
                          artistName: artistName || undefined,
                          email: email || undefined,
                          marketingConsent: marketingOptIn,
                          assessmentConsent,
                        });
                        if (id) setAssessmentId(id);
                      }
                    }}
                    className="space-y-4 max-w-lg"
                  >
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
                        <span>Send me a copy of my Artist Passport assessment.</span>
                      </label>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={marketingOptIn}
                          onChange={(e) => setMarketingOptIn(e.target.checked)}
                          className="mt-0.5 rounded border-white/20 text-[#FFB800] focus:ring-[#FFB800]"
                        />
                        <span>Optional: Keep me updated on indii.music platform releases and early access invitations.</span>
                      </label>
                    </div>

                    {email && (
                      <button
                        type="submit"
                        className="text-xs font-mono px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                      >
                        Save Email Copy
                      </button>
                    )}
                  </form>
                ) : (
                  <div className="p-4 rounded-xl bg-black/60 border border-[#00FF66]/30 text-xs text-[#00FF66] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Your assessment copy request is saved for {email}.</span>
                  </div>
                )}

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-white/10">
                  <Link
                    to={`/signup${referralQuery}${assessmentId ? `&assessmentId=${encodeURIComponent(assessmentId)}` : ''}`}
                    onClick={() => trackPassportEvent('signup_clicked', { cta: 'claim_passport' }, assessmentId)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-black text-black bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#E65100] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_28px_rgba(255,184,0,0.4)]"
                  >
                    <span>Claim Your Artist Passport & Enter Studio</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    to={`/#waitlist${referralQuery}${assessmentId ? `&assessmentId=${encodeURIComponent(assessmentId)}` : ''}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    <span>Join Founding Artist Waitlist</span>
                  </Link>
                </div>

                <div className="text-[11px] text-[#8A8F9E] leading-relaxed">
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

              {/* 6. Still Not Convinced? Bridge to Landing Page */}
              <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-[#121318] via-[#090A0E] to-[#050507] border border-white/10 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/15 bg-white/5 text-[11px] font-mono text-[#8A8F9E] uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FFB800]" />
                    <span>Still Not Convinced?</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#8A8F9E]">
                    See The Proof • Free Test Drive
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Want to see the full platform before creating an account?
                  </h3>
                  <p className="text-sm text-[#8A8F9E] leading-relaxed max-w-2xl">
                    Take your time. Explore the complete indii.music workspace, check out our live studio walkthroughs,
                    our 0% royalty guarantee, and test drive the creative engine with our free mini-campaign on the main site.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <Link
                    to={`/${referralQuery}${referralQuery.includes('?') ? '&' : '?'}from=passport${assessmentId ? `&assessmentId=${encodeURIComponent(assessmentId)}` : ''}#studio-preview`}
                    onClick={() => trackPassportEvent('freebie_clicked', { cta: 'still_not_convinced' }, assessmentId)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 border border-white/15 hover:border-[#FFB800]/50 transition-all group"
                  >
                    <span>Still Not Convinced? See Full Platform & Free Tools</span>
                    <ArrowRight className="w-4 h-4 text-[#FFB800] transition-transform group-hover:translate-x-1" />
                  </Link>

                  <span className="text-xs font-mono text-[#8A8F9E]">
                    Zero sign-up required to explore
                  </span>
                </div>
              </div>
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
      <footer className="relative z-20 border-t border-[#1F222A] bg-[#000000] px-6 py-6 text-center text-xs text-[#8A8F9E]">
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
    </div>
  );
}
