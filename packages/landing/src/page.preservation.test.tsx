/**
 * Preservation guard for the home page transformation.
 *
 * Renders the REAL Home component (not a mock) with only Firebase and the
 * WebGL layer stubbed, and asserts that every conversion-critical string and
 * system marker from the pre-transformation site is still present. This is the
 * tripwire for copy drift during the section extraction.
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
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

// framer-motion's whileInView uses IntersectionObserver, which jsdom lacks.
class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

import Home from './page';

describe('home page preservation (founder mode)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
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

  /** Hero words are inline-blocks separated by margins — compare spacing-insensitively. */
  const normalized = (value: string) => value.replace(/\s+/g, '');

  it('keeps every critical hero claim and CTA', async () => {
    await renderHome();
    const text = container.textContent ?? '';
    expect(normalized(text)).toContain(normalized('Run your music career without giving $ıt away.'));
    expect(text).toContain('The Artist Operating System');
    expect(text).toContain('Tools for your music career');
    expect(text).toContain('without sacrifice');
    expect(text).toContain('Distribution is the last gatekeeper standing');
    expect(text).toContain('The Freedom Principle');
    expect(text).toContain('Direct Distribution Pipeline');
    expect(text).toContain('Distribution IS The Workspace');
    expect(text).toContain('No Handlers. 24 Specialists.');
    expect(text).toContain('100%');
    expect(text).toContain('0%');
    expect(text).toContain('24');
    // Preview closed → the hero CTA is the waitlist join (original behavior).
    expect(text).toContain('Join Waitlist');
    expect(text).toContain('Watch the Thesis');
    // The "$ıt" wordplay must survive intact.
    expect(text).toContain('ıt');
  });

  it('keeps the waitlist conversion path', async () => {
    await renderHome();
    const text = container.textContent ?? '';
    expect(text).toContain('Join the founder waitlist.');
    const input = container.querySelector('input[type="email"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('placeholder')).toBe('Enter your email');
  });

  it('keeps the story sections and their headlines', async () => {
    await renderHome();
    const text = container.textContent ?? '';
    expect(text).toContain('Built in Detroit for your work');
    expect(text).toContain('behind the music scene.');
    expect(text).toContain('Read the');
    expect(text).toContain('argument.');
    expect(text).toContain('Launch cinematic thesis');
    expect(text).toContain('One workspace');
    expect(text).toContain('24 connected departments');
    expect(text).toContain('Artist review');
    expect(text).toContain('0% royalty share');
    expect(text).toContain('The music industry was built');
    expect(text).toContain('upside-down.');
    expect(text).toContain('Every department you need.');
    expect(text).toContain('Under your direct command.');
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
    const text = container.textContent ?? '';
    expect(text).toContain('$2,500');
    expect(text).toContain('Secure Founder Access');
    expect(text).toContain('Lifetime access to the Founder edition');
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
    const markers = Array.from(container.querySelectorAll('[data-system-section]')).map(
      (el) => el.getAttribute('data-system-section'),
    );
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
      'footer',
    ]) {
      expect(markers).toContain(expected);
    }
  });

  it('keeps the working execution paths in the capabilities grid', async () => {
    await renderHome();
    const text = container.textContent ?? '';
    expect(text).toContain('Deliver directly to Spotify, Apple & Tidal.');
    expect(text).toContain('DDEX ERN 4.3');
    expect(text).toContain('Working Execution Path');
    expect(text).toContain('Master WAV → DDEX Metadata → Schema Verification → Global Delivery');
  });
});

describe('home page preservation (public mode)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
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
    expect(text).toContain('Join the founder waitlist.');
    // With the preview closed, the hero CTA is the waitlist join.
    expect(text).toContain('Join Waitlist');
    expect(text).not.toContain('Enter Founder Preview');
    expect(text).not.toContain('Secure Founder Access');
    expect(text).not.toContain('Built in Detroit for your work');
    expect(text).not.toContain('Launch cinematic thesis');
    expect(text).not.toContain('Project White Glove');
    expect(text).not.toContain('Contact');
  });
});
