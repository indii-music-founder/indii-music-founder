// Structural-only component regression coverage; not genuine-user acceptance.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PassportResultPage from './PassportResultPage';
import type { PassportAnswers } from '../lib/passportEvaluator';
import { buildPassportShareUrl, decodePassportShare, encodePassportShare } from '../lib/passportShare';

const ANSWERS: PassportAnswers = {
  careerStage: 'Building momentum',
  genre: 'Electronic / Dance',
  proAffiliation: 'ASCAP',
  mlcRegistered: 'No',
  distributor: 'DistroKid',
  releaseStatus: 'Mixing or mastering',
  goals: ['Improve royalty registration and tracking', 'Plan and market a release'],
};

function encodeRaw(payload: unknown): string {
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('passportShare codec', () => {
  it('round-trips answers through a URL-safe code', () => {
    const code = encodePassportShare(ANSWERS);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePassportShare(code)).toEqual({ ...ANSWERS, customGenre: undefined });
  });

  it('never carries contact data and builds a /passport/r/ URL', () => {
    const withContact = { ...ANSWERS, email: 'a@b.co', artistName: 'Secret' } as PassportAnswers;
    const json = atob(encodePassportShare(withContact).replace(/-/g, '+').replace(/_/g, '/'));
    expect(json).not.toContain('a@b.co');
    expect(json).not.toContain('Secret');
    expect(buildPassportShareUrl(ANSWERS, 'https://indii.music')).toMatch(/^https:\/\/indii\.music\/passport\/r\/[A-Za-z0-9_-]+$/);
  });

  it('keeps a sanitized custom genre only for "Other"', () => {
    const decoded = decodePassportShare(encodePassportShare({ ...ANSWERS, genre: 'Other', customGenre: 'Jersey <script>Club</script> ✨' }));
    expect(decoded?.customGenre).toBe('Jersey scriptClub/script');
    expect(decodePassportShare(encodePassportShare({ ...ANSWERS, customGenre: 'ignored' }))?.customGenre).toBeUndefined();
  });

  it('rejects tampered, off-whitelist, or garbage codes', () => {
    expect(decodePassportShare(undefined)).toBeNull();
    expect(decodePassportShare('!!!')).toBeNull();
    expect(decodePassportShare('a'.repeat(2000))).toBeNull();
    expect(decodePassportShare(encodeRaw({ v: 1, c: 'Hacker stage', g: 'Electronic / Dance', p: 'ASCAP', m: 'No', d: 'DistroKid', r: 'Mixing or mastering', o: [] }))).toBeNull();
    expect(decodePassportShare(encodeRaw({ v: 2 }))).toBeNull();
    expect(decodePassportShare(encodeRaw({ v: 1, c: 'Building momentum', g: 'Electronic / Dance', p: 'ASCAP', m: 'No', d: 'DistroKid', r: 'Mixing or mastering', o: ['a', 'b', 'c'] }))).toBeNull();
  });
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/passport/r/:code" element={<PassportResultPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PassportResultPage', () => {
  it('renders the shared stage, finding and a take-yours CTA', () => {
    renderAt(`/passport/r/${encodePassportShare(ANSWERS)}`);
    expect(screen.getByRole('heading', { level: 1, name: 'Building momentum' })).toBeTruthy();
    expect(screen.getByText(/Possible Streaming Mechanical Collection Gap/)).toBeTruthy();
    const cta = screen.getByRole('link', { name: /Get your own Passport/ });
    expect(cta.getAttribute('href')).toContain('/passport?utm_source=passport_share');
  });

  it('shows a recoverable state for a broken link', () => {
    renderAt('/passport/r/not-a-real-code');
    expect(screen.getByRole('heading', { name: /doesn.t open/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Get your own Passport/ })).toBeTruthy();
  });
});
