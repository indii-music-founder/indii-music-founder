'use client';

import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from './components/auth/AuthProvider';
import { getStudioPreviewUrl, getStudioUrl } from './lib/auth';
import {
  beginFoundingArtistVerification,
  completeFoundingArtistVerification,
  enrollCurrentVerifiedArtist,
  getStoredFoundingArtistEmail,
  getStoredMilestoneConsent,
  isCompletingFoundingArtistLink,
} from './lib/foundingArtistWaitlist';
import { flushFounderFunnelQueue, trackFounderFunnelEvent } from './lib/founderFunnel';
import { isFounderPreviewEnabled } from './lib/previewAccess';
import { emitSystemPulse } from './three/signals';
import { detectTier, detectInputs } from './three/quality';
import Hero from './components/sections/Hero';
import WaitlistSection from './components/sections/WaitlistSection';
import FooterSection from './components/sections/FooterSection';

/**
 * The WebGL system layer is lazy-loaded: the DOM paints and the hero words
 * animate first; the canvas fades in over it a beat later. This keeps the
 * critical path free of the three.js chunk. When the device cannot or should
 * not run WebGL (reduced motion, no WebGL2, weak hardware), the chunk is not
 * even downloaded — the DOM background carries the design instead.
 */
const ExperienceShell = lazy(() => import('./components/ExperienceShell'));
const ThesisCrawl = lazy(() => import('./components/ThesisCrawl'));

// Below-the-fold sections are code-split: their JS is fetched and parsed only
// when the section approaches the viewport (see LazySection below).
const AgentGrid = lazy(() => import('./components/AgentGrid'));
const ConductorSection = lazy(() => import('./components/ConductorSection'));
const AppStudioShowcase = lazy(() => import('./components/AppStudioShowcase'));
const LegacyComparison = lazy(() => import('./components/LegacyComparison'));
const DetroitSection = lazy(() => import('./components/sections/DetroitSection'));
const ThesisSection = lazy(() => import('./components/sections/ThesisSection'));
const StatsBand = lazy(() => import('./components/sections/StatsBand'));
const PrinciplesSection = lazy(() => import('./components/sections/PrinciplesSection'));
const OnboardingSection = lazy(() => import('./components/sections/OnboardingSection'));
const FounderAccessSection = lazy(() => import('./components/sections/FounderAccessSection'));
const PricingSection = lazy(() => import('./components/sections/PricingSection'));
const systemTier = typeof window === 'undefined' ? 'FALLBACK' : detectTier(detectInputs());
const shouldMountSystem = systemTier !== 'FALLBACK';

/**
 * The WebGL canvas layer is decorative (aria-hidden): it must never compete
 * with first paint, the hero, or the waitlist form for the main thread. The
 * chunk is fetched and WebGL initialized only after the window load event
 * (plus a small grace beat so LCP wins the race), with a hard failsafe so
 * the canvas still appears on slow networks where load is late.
 */
function DeferredExperienceShell() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      window.setTimeout(() => {
        if (!cancelled) setReady(true);
      }, 300);
    };
    if (document.readyState === 'complete') {
      start();
    } else {
      window.addEventListener('load', start, { once: true });
    }
    const failsafe = window.setTimeout(start, 6000);
    return () => {
      cancelled = true;
      window.removeEventListener('load', start);
      window.clearTimeout(failsafe);
    };
  }, []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <ExperienceShell />
    </Suspense>
  );
}

/**
 * LazySection — renders below-the-fold marketing sections only when they
 * approach the viewport (IntersectionObserver), when the URL hash targets
 * them (e.g. #capabilities, #conductor, #founder-access), or when a search
 * engine crawler is rendering the page (content stays indexable).
 * Deferring these sections keeps first paint and the hero on the main
 * thread; every section renders once approached, with no visual change.
 */
function LazySection({ id, children }: { id?: string; children: React.ReactNode }) {
  // Renders immediately when there is no observer support, when a search
  // engine renderer is reading the page (content stays indexable), or when
  // the URL hash already targets this section.
  const [visible, setVisible] = useState(() => {
    if (typeof IntersectionObserver === 'undefined') return true;
    if (/bot|crawl|spider|googlebot|bingbot|duckduckbot|slurp|yandex|baiduspider|facebookexternalhit|twitterbot/i.test(navigator.userAgent)) {
      return true;
    }
    return Boolean(id && window.location.hash === '#' + id);
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const show = () => setVisible(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          show();
          io.disconnect();
        }
      },
      { rootMargin: '900px 0px' },
    );
    io.observe(el);
    const onHash = () => {
      if (id && window.location.hash === '#' + id) {
        show();
        window.removeEventListener('hashchange', onHash);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      io.disconnect();
      window.removeEventListener('hashchange', onHash);
    };
  }, [id, visible]);

  return <div ref={ref}>{visible ? <Suspense fallback={null}>{children}</Suspense> : null}</div>;
}

const ambientStars = Array.from({ length: 72 }, (_, index) => ({
  left: `${(index * 37.31) % 100}%`,
  top: `${(index * 61.73) % 100}%`,
  size: `${index % 9 === 0 ? 2 : index % 4 === 0 ? 1.5 : 1}px`,
  opacity: 0.12 + ((index * 17) % 48) / 100,
}));

export default function Home({ founder = true }: { founder?: boolean }) {
  const { user, loading } = useAuth();
  const previewEnabled = isFounderPreviewEnabled();
  const previewHref = previewEnabled ? getStudioPreviewUrl() : '#waitlist';
  const hasTrackedFounderView = useRef(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'loading' | 'sent' | 'success' | 'error'>('idle');
  const [waitlistMessage, setWaitlistMessage] = useState('');
  const [isManagingUpdates] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('manageUpdates') === 'true';
  });
  const [majorMilestoneUpdates, setMajorMilestoneUpdates] = useState(() => {
    if (typeof window === 'undefined') return true;
    return new URLSearchParams(window.location.search).get('manageUpdates') !== 'true';
  });
  const [isThesisOpen, setIsThesisOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const { hostname, search, hash } = window.location;
    return hostname.includes('founders') || search.includes('thesis=true') || hash.includes('#thesis');
  });

  useEffect(() => {
    flushFounderFunnelQueue();
    if (founder && !hasTrackedFounderView.current) {
      hasTrackedFounderView.current = true;
      void trackFounderFunnelEvent(
        'founder_site_view',
        {
          surface: 'landing_home',
          variant: user ? 'returning' : 'new',
        },
        {
          userId: user?.uid ?? null,
          email: user?.email ?? null,
        },
      );
    }
  }, [founder, user]);

  useEffect(() => {
    if (!isCompletingFoundingArtistLink()) return;
    const storedEmail = getStoredFoundingArtistEmail();
    const storedMilestoneConsent = getStoredMilestoneConsent();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (!storedEmail) {
        setWaitlistMessage('Enter the same email address to finish verification.');
        return;
      }

      setWaitlistStatus('loading');
      setWaitlistEmail(storedEmail);
      setMajorMilestoneUpdates(storedMilestoneConsent);
      void completeFoundingArtistVerification(storedEmail, storedMilestoneConsent)
        .then((result) => {
          if (cancelled) return;
          setWaitlistStatus('success');
          setWaitlistMessage(isManagingUpdates
            ? 'Email verified. Your Founding Artist email preferences are updated.'
            : `Email verified. You are #${result.queuePosition} on the Founding Artist waitlist.`);
          window.history.replaceState({}, '', '/#waitlist');
          emitSystemPulse('waitlist', 0, 1);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          console.error('Waitlist verification error:', error);
          setWaitlistStatus('error');
          setWaitlistMessage('We could not finish verification. Enter your email and request a new link.');
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isManagingUpdates]);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail) return;
    setWaitlistStatus('loading');
    setWaitlistMessage('');
    try {
      if (isCompletingFoundingArtistLink()) {
        const result = await completeFoundingArtistVerification(waitlistEmail, majorMilestoneUpdates);
        setWaitlistStatus('success');
        setWaitlistMessage(isManagingUpdates
          ? 'Email verified. Your Founding Artist email preferences are updated.'
          : `Email verified. You are #${result.queuePosition} on the Founding Artist waitlist.`);
        window.history.replaceState({}, '', '/#waitlist');
        emitSystemPulse('waitlist', 0, 1);
        return;
      }

      const existingEnrollment = await enrollCurrentVerifiedArtist(waitlistEmail, majorMilestoneUpdates);
      if (existingEnrollment) {
        setWaitlistStatus('success');
        setWaitlistMessage(isManagingUpdates
          ? 'Your Founding Artist email preferences are updated.'
          : `You are #${existingEnrollment.queuePosition} on the Founding Artist waitlist.`);
        emitSystemPulse('waitlist', 0, 1);
        return;
      }

      await beginFoundingArtistVerification(waitlistEmail, majorMilestoneUpdates);
      setWaitlistStatus('sent');
      setWaitlistMessage(`Verification sent to ${waitlistEmail.trim().toLowerCase()}. Open that link to join the waitlist.`);
    } catch (err) {
      console.error('Waitlist error:', err);
      setWaitlistStatus('error');
      setWaitlistMessage('We could not start verification. Check the address and try again.');
    }
  };

  useEffect(() => {
    const schemaScript = document.createElement('script');
    schemaScript.type = 'application/ld+json';
    schemaScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://indii.music/#organization',
          name: 'indii.music',
          url: 'https://indii.music',
          slogan: 'music business at the speed of you',
          description: 'An artist-controlled workspace for the work around an independent music career.',
        },
        {
          '@type': 'WebSite',
          '@id': 'https://indii.music/#website',
          url: 'https://indii.music',
          name: 'indii.music',
          publisher: { '@id': 'https://indii.music/#organization' },
        },
        {
          '@type': 'Product',
          '@id': 'https://indii.music/#product',
          name: 'indii.music Founding Artist Beta',
          description: 'Working music-business software for independent artists, currently being refined through the Founding Artist Beta.',
        },
      ],
    });
    document.head.appendChild(schemaScript);
    return () => schemaScript.remove();
  }, []);

  const trackPreview = (location: string) => {
    void trackFounderFunnelEvent(
      'founder_preview_cta_clicked',
      {
        location,
        target: previewEnabled ? 'studio' : 'waitlist',
        label: previewEnabled ? 'Enter Founder Preview' : 'Join Waitlist',
      },
      {
        userId: user?.uid ?? null,
        email: user?.email ?? null,
      },
    );
  };

  const handleFounderInterestClick = async () => {
    await trackFounderFunnelEvent(
      'founder_interest_clicked',
      {
        location: 'footer',
        label: 'Founding Owner License',
      },
      {
        userId: user?.uid ?? null,
        email: user?.email ?? null,
      },
    );
    window.location.href = 'mailto:wiil@indii.music';
  };

  const handlePlanSelect = (plan: string) => {
    void trackFounderFunnelEvent(
      'founder_interest_clicked',
      {
        location: 'pricing',
        label: plan,
      },
      {
        userId: user?.uid ?? null,
        email: user?.email ?? null,
      },
    );
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0A0806] font-sans text-white selection:bg-amber-400/30">
      <a href="#home" className="skip-link">
        Skip to content
      </a>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 opacity-70">
          {ambientStars.map((star, index) => (
            <span
              key={index}
              className="absolute rounded-full bg-white"
              style={{
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
              }}
            />
          ))}
        </div>
        {/* Multi-spectrum atmospheric lighting across the whole page */}
        <div className="absolute left-1/2 top-[-26rem] h-[72rem] w-[72rem] -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-500/[0.22] via-[#00BCD4]/[0.16] to-transparent blur-[140px]" />
        <div className="absolute right-[-12rem] top-[18rem] h-[55rem] w-[55rem] rounded-full bg-[#00BCD4]/[0.14] blur-[150px]" />
        <div className="absolute left-[-12rem] top-[50rem] h-[55rem] w-[55rem] rounded-full bg-[#00FF66]/[0.12] blur-[160px]" />
        <div className="absolute right-[-10rem] top-[110rem] h-[60rem] w-[60rem] rounded-full bg-[#E91E63]/[0.11] blur-[170px]" />
        <div className="absolute left-[-10rem] top-[170rem] h-[60rem] w-[60rem] rounded-full bg-[#2196F3]/[0.12] blur-[170px]" />
        <div className="absolute right-[-8rem] top-[230rem] h-[55rem] w-[55rem] rounded-full bg-[#9C27B0]/[0.10] blur-[160px]" />
        <div className="absolute left-1/2 top-[300rem] h-[65rem] w-[65rem] -translate-x-1/2 rounded-full bg-amber-500/[0.14] blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,transparent_20%,#0A0806_88%)]" />
        <div className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:80px_80px]" />
      </div>

      {shouldMountSystem && <DeferredExperienceShell />}

      <nav className="fixed inset-x-0 top-0 z-50 border-b border-amber-400/20 bg-[#14100C]/85 shadow-[0_10px_35px_rgba(0,0,0,0.7)] backdrop-blur-2xl" aria-label="Main navigation">
        <div className="flex min-h-7 items-center justify-center gap-3 border-b border-amber-400/30 bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] px-4 py-1 text-center font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-black shadow-[0_1px_15px_rgba(255,184,0,0.3)]">
          <span>Founding Artist Beta — working software, still being refined</span>
          <a href="#waitlist" className="underline decoration-black/40 underline-offset-2 hover:decoration-black">
            Join the waitlist
          </a>
        </div>
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center justify-between px-5 md:px-10">
          <a href="#home" className="text-[15px] font-black tracking-[-0.025em] text-white transition-all hover:text-[#FFB800] hover:[text-shadow:0_0_15px_rgba(255,184,0,0.7)]" aria-label="indii.music home">
            indii.music
          </a>

          <div className="hidden items-center gap-7 font-mono text-[9px] uppercase tracking-[0.2em] text-white/50 md:flex">
            <a href="#capabilities" className="py-2 transition-colors hover:text-white">
              Release lifecycle
            </a>
            <a href="#conductor" className="py-2 transition-colors hover:text-white">
              Conductor
            </a>
            <a href="#pricing" className="py-2 transition-colors hover:text-white">
              Pricing
            </a>
            {founder && (
              <button type="button" onClick={() => setIsThesisOpen(true)} className="py-2 transition-colors hover:text-white">
                Thesis
              </button>
            )}
            <a href="#founder-access" className="py-2 font-bold text-[#FFB800] [text-shadow:0_0_10px_rgba(255,184,0,0.5)] transition-colors hover:text-amber-300">
              Founding Owner
            </a>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <a
              href={getStudioUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackPreview('nav_login')}
              className="inline-flex items-center px-3 py-2.5 text-xs font-bold text-white/70 transition-colors hover:text-white"
            >
              Log in
            </a>
            <a
              href={previewHref}
              target={previewEnabled ? '_blank' : undefined}
              rel={previewEnabled ? 'noopener noreferrer' : undefined}
              onClick={() => trackPreview('nav')}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] px-4 py-2.5 text-xs font-black text-black shadow-[0_0_20px_rgba(255,184,0,0.4)] transition-all hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(255,184,0,0.65)] md:px-5"
            >
              <span>{previewEnabled ? (loading ? 'Verifying…' : user ? 'Resume session' : 'Enter preview') : 'Get access'}</span>
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </nav>

      <Hero founder={founder} previewEnabled={previewEnabled} previewHref={previewHref} trackPreview={trackPreview} />

      {!previewEnabled && (
        <WaitlistSection
          email={waitlistEmail}
          status={waitlistStatus}
          message={waitlistMessage}
          majorMilestoneUpdates={majorMilestoneUpdates}
          preferenceMode={isManagingUpdates}
          onChange={setWaitlistEmail}
          onMilestoneUpdatesChange={setMajorMilestoneUpdates}
          onSubmit={handleWaitlistSubmit}
        />
      )}

      <LazySection id="detroit">{founder && <DetroitSection />}</LazySection>

      <LazySection>{founder && <ThesisSection setIsThesisOpen={setIsThesisOpen} />}</LazySection>

      <LazySection>
        <StatsBand />
      </LazySection>

      <LazySection id="legacy-shift">
        <LegacyComparison />
      </LazySection>
      <LazySection id="capabilities">
        <AgentGrid />
      </LazySection>
      <LazySection id="conductor">
        <ConductorSection />
      </LazySection>
      <LazySection id="studio-preview">
        <AppStudioShowcase />
      </LazySection>
      <LazySection>
        <PrinciplesSection />
      </LazySection>

      <LazySection>{founder && <OnboardingSection />}</LazySection>

      <LazySection id="founder-access">
        <FounderAccessSection trackPreview={trackPreview} />
      </LazySection>

      <LazySection id="pricing">
        <PricingSection onPlanSelect={handlePlanSelect} />
      </LazySection>

      <FooterSection founder={founder} onContactClick={handleFounderInterestClick} />

      {founder && (
        <Suspense fallback={null}>
          <ThesisCrawl isOpen={isThesisOpen} onClose={() => setIsThesisOpen(false)} />
        </Suspense>
      )}
    </main>
  );
}
