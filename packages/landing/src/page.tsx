'use client';

import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from './components/auth/AuthProvider';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './lib/firebase';
import { getStudioPreviewUrl, getStudioUrl } from './lib/auth';
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
const FounderRoyaltyCalculator = lazy(() =>
  import('./components/FounderRoyaltyCalculator').then((m) => ({ default: m.FounderRoyaltyCalculator })),
);
const DetroitSection = lazy(() => import('./components/sections/DetroitSection'));
const ThesisSection = lazy(() => import('./components/sections/ThesisSection'));
const StatsBand = lazy(() => import('./components/sections/StatsBand'));
const PrinciplesSection = lazy(() => import('./components/sections/PrinciplesSection'));
const OnboardingSection = lazy(() => import('./components/sections/OnboardingSection'));
const FounderAccessSection = lazy(() => import('./components/sections/FounderAccessSection'));
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
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        show();
        io.disconnect();
      }
    }, { rootMargin: '900px 0px' });
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

  return (
    <div ref={ref}>
      {visible ? <Suspense fallback={null}>{children}</Suspense> : null}
    </div>
  );
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
  const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [waitlistMessage, setWaitlistMessage] = useState('');
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

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail || !db) return;
    setWaitlistStatus('loading');
    setWaitlistMessage('');
    try {
      await addDoc(collection(db, 'waitlist'), {
        email: waitlistEmail,
        createdAt: serverTimestamp(),
        source: 'landing_page'
      });
      setWaitlistStatus('success');
      setWaitlistMessage("You're on the list. We'll be in touch.");
      setWaitlistEmail('');
      emitSystemPulse('waitlist', 0, 1);
    } catch (err) {
      console.error('Waitlist error:', err);
      setWaitlistStatus('error');
      setWaitlistMessage("Something went wrong. Please try again later.");
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
          description:
            'An artist-controlled workspace for the work around an independent music career.',
        },
        {
          '@type': 'WebSite',
          '@id': 'https://founder.indii.music/#website',
          url: 'https://founder.indii.music',
          name: 'indii.music Founder Access',
          publisher: { '@id': 'https://indii.music/#organization' },
        },
        {
          '@type': 'Product',
          '@id': 'https://founder.indii.music/#product',
          name: 'indii.music Founder Access',
          description:
            'A one-time software purchase for lifetime access to the indii.music Founder edition, guided onboarding, Boardroom, Conductor, and founder-level updates.',
          offers: {
            '@type': 'Offer',
            url: 'https://founder.indii.music',
            price: '2500',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            seller: { '@id': 'https://indii.music/#organization' },
          },
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
        label: 'Founder Access',
      },
      {
        userId: user?.uid ?? null,
        email: user?.email ?? null,
      },
    );
    window.location.href = 'mailto:wiil@indii.music';
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#020202] font-sans text-white selection:bg-amber-400/30">
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
        <div className="absolute left-1/2 top-[-32rem] h-[68rem] w-[68rem] -translate-x-1/2 rounded-full bg-amber-500/[0.08] blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_15%,#020202_82%)]" />
        <div className="absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:80px_80px]" />
      </div>

      {shouldMountSystem && <DeferredExperienceShell />}

      <nav
        className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/65 backdrop-blur-2xl"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center justify-between px-5 md:px-10">
          <a
            href="#home"
            className="text-[15px] font-bold tracking-[-0.025em] text-white transition-colors hover:text-amber-400"
            aria-label="indii.music home"
          >
            indii.music
          </a>

          <div className="hidden items-center gap-7 font-mono text-[9px] uppercase tracking-[0.2em] text-white/45 md:flex">
            <a href="#capabilities" className="py-2 transition-colors hover:text-white">
              The system
            </a>
            <a href="#conductor" className="py-2 transition-colors hover:text-white">
              Conductor
            </a>
            {founder && (
              <button type="button" onClick={() => setIsThesisOpen(true)} className="py-2 transition-colors hover:text-white">
                Thesis
              </button>
            )}
            {founder && (
              <a href="#founder-access" className="py-2 text-amber-400 transition-colors hover:text-amber-300">
                Founder access
              </a>
            )}
          </div>

          <a
            href={previewHref}
            target={previewEnabled ? '_blank' : undefined}
            rel={previewEnabled ? 'noopener noreferrer' : undefined}
            onClick={() => trackPreview('nav')}
            className="group inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-black transition-transform hover:scale-[1.03] md:px-5"
          >
            <span>
              {previewEnabled
                ? loading
                  ? 'Verifying…'
                  : user
                    ? 'Resume session'
                    : 'Enter preview'
                : 'Join Waitlist'}
            </span>
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </nav>

      <Hero
        founder={founder}
        previewEnabled={previewEnabled}
        previewHref={previewHref}
        trackPreview={trackPreview}
        setIsThesisOpen={setIsThesisOpen}
      />

      {!previewEnabled && (
        <WaitlistSection
          email={waitlistEmail}
          status={waitlistStatus}
          message={waitlistMessage}
          onChange={setWaitlistEmail}
          onSubmit={handleWaitlistSubmit}
        />
      )}

      <LazySection id="detroit">{founder && <DetroitSection />}</LazySection>

      <LazySection>
        {founder && <ThesisSection setIsThesisOpen={setIsThesisOpen} />}
      </LazySection>

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
        <FounderRoyaltyCalculator />
      </LazySection>
      <LazySection>
        <PrinciplesSection />
      </LazySection>

      <LazySection>{founder && <OnboardingSection />}</LazySection>

      <LazySection id="founder-access">
        {founder && (
          <FounderAccessSection studioUrl={getStudioUrl()} trackPreview={trackPreview} />
        )}
      </LazySection>

      <FooterSection founder={founder} onContactClick={handleFounderInterestClick} />

      {founder && (
        <Suspense fallback={null}>
          <ThesisCrawl
            isOpen={isThesisOpen}
            onClose={() => setIsThesisOpen(false)}
          />
        </Suspense>
      )}
    </main>
  );
}
