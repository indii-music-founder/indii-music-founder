/**
 * Preservation guard for the home page transformation.
 *
 * Renders the REAL Home component (not a mock) with only Firebase and the
 * WebGL layer stubbed, and asserts that every conversion-critical string and
 * system marker from the approved Founding Artist Beta positioning is still
 * present. This is the tripwire for unsupported claim and conversion-path drift.
 *
 * The below-the-fold sections are now deferred (LazySection): they mount only
 * when they approach the viewport, when the URL hash targets them, or when a
 * crawler renders the page. The stub IntersectionObserver below lets the tests
 * both verify the deferred contract (sections absent before any intersection)
 * and then reveal every section so the full-content tripwire still runs.
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'mock-doc' }),
  serverTimestamp: vi.fn(() => ({ toDate: () => new Date() })),
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => () => undefined),
}));

vi.mock('./lib/firebase', () => ({
  default: {},
  auth: undefined,
  db: null,
}));

vi.mock('./lib/auth', () => ({
  getStudioPreviewUrl: () => 'http://studio.test/preview',
  getStudioUrl: () => 'http://studio.test',
}));

vi.mock('./lib/founderFunnel', () => ({
  flushFounderFunnelQueue: vi.fn(),
  trackFounderFunnelEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./lib/previewAccess', () => ({
  isFounderPreviewEnabled: () => false,
}));

vi.mock('./components/ExperienceShell', () => ({
  default: () => null,
}));

// framer-motion's whileInView and the page's LazySection both use
// IntersectionObserver. jsdom 26 ships its own implementation; force the
// controllable stub so the deferred-sections contract is deterministic.
interface StubIOEntry {
  isIntersecting: boolean;
  target: Element;
}
const ioInstances: IntersectionObserverStub[] = [];
class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];
  private callback: (entries: StubIOEntry[]) => void;
  private observed: Element[] = [];

  constructor(callback: (entries: StubIOEntry[]) => void) {
    this.callback = callback;
    ioInstances.push(this);
  }

  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.observed = [];
  }
  takeRecords() {
    return [];
  }

  /** Test helper: report every observed element as intersecting. */
  revealAll() {
    this.callback(this.observed.map((target) => ({ isIntersecting: true, target })));
  }
}
globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;

import Home from './page';

describe('home page preservation (founder mode)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  // Pre-warm the lazy section chunks (vite-node transforms each chunk on first
  // import, which is far too slow to happen inside a test). The REAL components
  // still render and are asserted below — this only avoids transform latency.
  beforeAll(async () => {
    await Promise.all([
      import('./components/AgentGrid'),
      import('./components/ConductorSection'),
      import('./components/AppStudioShowcase'),
      import('./components/LegacyComparison'),
      import('./components/sections/DetroitSection'),
      import('./components/sections/ThesisSection'),
      import('./components/sections/StatsBand'),
      import('./components/sections/PrinciplesSection'),
      import('./components/sections/OnboardingSection'),
      import('./components/sections/FounderAccessSection'),
      import('./components/sections/PricingSection'),
    ]);
  });

  beforeEach(() => {
    ioInstances.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  const renderHome = async () => {
    await act(async () => {
      root.render(<Home founder />);
    });
  };

  /** Fire every pending intersection and wait for the lazy section chunks to resolve. */
  const revealSections = async () => {
    await act(async () => {
      for (const io of ioInstances) io.revealAll();
      // LazySection updates state, then each lazy() chunk resolves asynchronously.
      // Modules are pre-warmed in beforeAll, so this resolves quickly.
      for (let i = 0; i < 40; i++) {
        const markers = container.querySelectorAll('[data-system-section]').length;
        if (markers >= 14) break; // hero, waitlist, footer + the 11 deferred sections
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });
  };

  /** Hero words are inline-blocks separated by margins — compare spacing-insensitively. */
  const normalized = (value: string) => value.replace(/\s+/g, '');

  it('defers the below-the-fold sections until they approach the viewport', async () => {
    await renderHome();
    // Eager, above-the-fold content is present immediately...
    const text = container.textContent ?? '';
    expect(normalized(text)).toContain(normalized('Run your music career without giving $ıt away.'));
    expect(container.querySelector('[data-system-section="waitlist"]')).not.toBeNull();
    // ...while deferred sections are not in the DOM until an intersection fires.
    expect(container.querySelector('[data-system-section="capabilities"]')).toBeNull();
    expect(container.querySelector('[data-system-section="founder-access"]')).toBeNull();
    expect(container.querySelector('[data-system-section="conductor"]')).toBeNull();
    // Once the observer reports an intersection, the sections render in full.
    await revealSections();
    expect(container.querySelector('[data-system-section="capabilities"]')).not.toBeNull();
    expect(container.querySelector('[data-system-section="founder-access"]')).not.toBeNull();
    expect(container.querySelector('[data-system-section="conductor"]')).not.toBeNull();
  });

  it('keeps every critical hero claim and CTA', async () => {
    await renderHome();
    const text = container.textContent ?? '';
    expect(normalized(text)).toContain(normalized('Run your music career without giving $ıt away.'));
    expect(text).toContain('The operating system for your music independence.');
    expect(text).toContain('music business at the speed of you');
    expect(text).toContain('Run the business behind your music');
    expect(text).toContain('One connected workspace.');
    expect(text).toContain('Get Founding Artist access');
    expect(text).toContain('See how indii.music works');
    expect(text).toContain('Working software / Founding Artist Beta');
    // The "$ıt" wordplay must survive intact.
    expect(text).toContain('ıt');
    // The public page must not revive unsupported legacy promises.
    await revealSections();
    const revealed = container.textContent ?? '';
    expect(revealed).toContain('The Freedom Principle');
    expect(revealed).toContain('Keep Your rights');
    expect(revealed).toContain('0% Royalty Cut');
    expect(revealed).not.toContain('Distribution is the last gatekeeper standing');
    expect(revealed).not.toContain('Direct Distribution Pipeline');
    expect(revealed).not.toContain('No Handlers. 24 Specialists.');
    expect(revealed).not.toContain('Deliver directly to Spotify');
  });

  it('keeps the waitlist conversion path', async () => {
    await renderHome();
    const text = container.textContent ?? '';
    expect(text).toContain('Join the Founding Artist Beta waitlist.');
    expect(text).toContain('first-come beta invitations');
    expect(text).toContain('early-pricing priority');
    const input = container.querySelector('input[type="email"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('placeholder')).toBe('Enter your email');
  });

  it('keeps the story sections and their headlines', async () => {
    await renderHome();
    await revealSections();
    const text = container.textContent ?? '';
    expect(text).toContain('Built in Detroit for your work');
    expect(text).toContain('behind the music scene.');
    expect(text).toContain('Read the');
    expect(text).toContain('argument.');
    expect(text).toContain('Launch cinematic thesis');
    expect(text).toContain('One workspace');
    expect(text).toContain('Connected work');
    expect(text).toContain('Shared project context');
    expect(text).toContain('Artist Review');
    expect(text).toContain('0% royalty share');
    expect(text).toContain('The music industry was built');
    expect(text).toContain('upside-down.');
    expect(text).toContain('Run the whole release.');
    expect(text).toContain('Keep the context connected.');
    expect(text).toContain('One direction.');
    expect(text).toContain('The whole system moves.');
    expect(text).toContain('See how your career');
    expect(text).toContain('actually gets run.');
    expect(text).toContain('You stay the artist.');
    expect(text).toContain('You also stay in control.');
    expect(text).toContain('Start with your real catalog');
    expect(text).toContain('not an empty dashboard.');
    expect(text).toContain('Project White Glove');
  });

  it('keeps the founder offer, disclaimers and footer', async () => {
    await renderHome();
    await revealSections();
    const text = container.textContent ?? '';
    expect(text).toContain('$2,500');
    expect(text).toContain('Founding Owner License');
    expect(text).toContain('Get Founding Owner access');
    expect(text).toContain('Permanent top-tier software access');
    expect(text).toContain('Usage available as needed after included allowances');
    expect(text).toContain('What you are buying');
    expect(text).toContain('What you are not buying');
    expect(text).toContain('Separate conversations');
    expect(text).toContain('Equity, profit participation, a security, or any right to a financial return.');
    expect(text).toContain('© 2026 New Detroit Music LLC');
    expect(text).toContain('Privacy');
    expect(text).toContain('Terms');
    expect(text).toContain('Contact');
  });

  it('marks every section for the system layer', async () => {
    await renderHome();
    await revealSections();
    const markers = Array.from(container.querySelectorAll('[data-system-section]')).map((el) => el.getAttribute('data-system-section'));
    for (const expected of [
      'hero',
      'waitlist',
      'detroit',
      'thesis',
      'stats',
      'legacy',
      'capabilities',
      'conductor',
      'studio',
      'principles',
      'onboarding',
      'founder-access',
      'pricing',
      'footer',
    ]) {
      expect(markers).toContain(expected);
    }
  });

  it('keeps the complete release lifecycle and its approved workflow promises', async () => {
    await renderHome();
    await revealSections();
    const text = container.textContent ?? '';
    expect(text).toContain('Prepare releases and delivery-ready packages.');
    expect(text).toContain('DDEX ERN 4.3');
    expect(text).toContain('Finished music → Plan → Register → Prepare delivery → Campaign → Release → Track → Repeat');
    expect(text).toContain('Real product clip planned');
    expect(text).toContain('Mastered Audio → Release Metadata → Schema Verification → Delivery-Ready Package');
    expect(container.querySelector('button[aria-label="Register: Know what you own and what still needs to be registered."]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Track: Track income, expenses, and splits together."]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Campaign: Turn finished music into a coordinated visual campaign."]')).not.toBeNull();

    const registerStage = container.querySelector(
      'button[aria-label="Register: Know what you own and what still needs to be registered."]',
    ) as HTMLButtonElement;
    await act(async () => {
      registerStage.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(registerStage.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows public beta pricing without presenting checkout as active', async () => {
    await renderHome();
    await revealSections();
    const text = container.textContent ?? '';
    expect(text).toContain('Choose the stage that fits');
    expect(text).toContain('your career now.');
    expect(text).toContain('$0');
    expect(text).toContain('$22');
    expect(text).toContain('$55');
    expect(text).toContain('$110');
    expect(text).toContain('Monthly, quarterly, six-month, or annual.');
    expect(text).toContain('About 5% less');
    expect(text).toContain('About 10% less');
    expect(text).toContain('About 20% less');
    expect(text).toContain('checkout remains closed until plan entitlements are verified');
    expect(text).toContain('Purchased extra capacity will not expire');
    expect(container.querySelector('a[href*="founders-checkout"]')).toBeNull();
    const founderOwnerLink = Array.from(container.querySelectorAll('a')).find((link) => link.textContent?.includes('Get Founding Owner access'));
    expect(founderOwnerLink?.getAttribute('href')).toBe('#waitlist');
  });
});

describe('home page preservation (public mode)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    ioInstances.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the waitlist CTA and hides founder-only sections', async () => {
    await act(async () => {
      root.render(<Home founder={false} />);
    });
    const text = container.textContent ?? '';
    expect(text).toContain('Join the Founding Artist Beta waitlist.');
    // With the preview closed, the hero CTA is the waitlist join.
    expect(text).toContain('Join Waitlist');
    expect(text).not.toContain('Enter Founder Preview');
    expect(text).not.toContain('Built in Detroit for your work');
    expect(text).not.toContain('Launch cinematic thesis');
    expect(text).not.toContain('Project White Glove');
    expect(text).not.toContain('Contact');
    // Reveal the lazy sections. Founder Access is public (decision
    // 2026-08-20) while the other founder-only sections stay hidden.
    await act(async () => {
      for (const io of ioInstances) io.revealAll();
      for (let i = 0; i < 12; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
    const revealed = container.textContent ?? '';
    expect(revealed).toContain('Founding Owner License');
    expect(revealed).toContain('Get Founding Owner access');
    expect(revealed).toContain('$2,500');
    expect(revealed).not.toContain('Built in Detroit for your work');
    expect(revealed).not.toContain('Launch cinematic thesis');
    // The onboarding section is founder-only — "Start with your real catalog"
    // is unique to it (the founders offer itself mentions White Glove).
    expect(revealed).not.toContain('Start with your real catalog');
    expect(revealed).not.toContain('Contact');
  });
});
