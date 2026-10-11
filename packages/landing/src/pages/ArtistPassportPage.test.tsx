import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ArtistPassportPage from './ArtistPassportPage';
import {
  evaluatePassport,
  type PassportAnswers,
} from '../lib/passportEvaluator';
import { readPassportEventLog } from '../lib/passportAnalytics';

describe('ArtistPassportPage - Deterministic Evaluation Engine', () => {
  it('correctly flags mechanical royalty leakage when PRO exists but MLC is missing', () => {
    const answers: PassportAnswers = {
      careerStage: 'Building momentum',
      genre: 'Electronic / Dance',
      proAffiliation: 'ASCAP',
      mlcRegistered: 'No',
      distributor: 'DistroKid',
      releaseStatus: 'Mixing or mastering',
      goals: ['Improve royalty registration and tracking', 'Plan and market a release'],
    };

    const report = evaluatePassport(answers);

    expect(report.rights.status).toBe('warning');
    expect(report.rights.title).toContain('Possible Streaming Mechanical Collection Gap');
    expect(report.rights.description).toContain('ASCAP');
    expect(report.rights.description).toContain('The MLC');
    expect(report.rights.actionRecommendation).toContain('possible registration or collection gap worth investigating');
  });

  it('correctly flags performance rights gap when no PRO is affiliated', () => {
    const answers: PassportAnswers = {
      careerStage: 'Just starting out',
      genre: 'Hip-Hop / Rap',
      proAffiliation: 'None',
      mlcRegistered: 'Not sure',
      distributor: 'Not distributing yet',
      releaseStatus: 'Still creating / producing',
      goals: ['Grow audience and fan engagement'],
    };

    const report = evaluatePassport(answers);

    expect(report.rights.status).toBe('warning');
    expect(report.rights.title).toContain('Performance Rights Registration Gap');
    expect(report.rights.actionRecommendation).toContain('Affiliate with a PRO');
  });

  it('marks foundation solid when both PRO and MLC are registered', () => {
    const answers: PassportAnswers = {
      careerStage: 'Established independent artist',
      genre: 'Indie / Alternative',
      proAffiliation: 'BMI',
      mlcRegistered: 'Yes',
      distributor: 'Symphonic',
      releaseStatus: 'Finished audio, preparing release',
      goals: ['Organize rights, collaborators, and splits'],
    };

    const report = evaluatePassport(answers);

    expect(report.rights.status).toBe('good');
    expect(report.rights.title).toContain('Dual-Royalty Foundation Established');
    expect(report.steps[0].title).toContain('100.00% Collaborator Split');
    expect(report.steps[0].department).toBe('Legal Counsel');
  });

  it('handles general territory rights overview when neither criteria met', () => {
    const answers: PassportAnswers = {
      careerStage: 'Building momentum',
      genre: 'Pop',
      proAffiliation: 'Other',
      mlcRegistered: 'Not applicable',
      distributor: 'TuneCore',
      releaseStatus: 'Already released / managing catalog',
      goals: ['Grow audience and fan engagement'],
    };

    const report = evaluatePassport(answers);

    expect(report.rights.status).toBe('notice');
    expect(report.rights.title).toContain('Rights & Territory Registration Overview');
    expect(report.release.status).toBe('info');
    expect(report.steps[1].department).toBe('Conductor Orchestrator');
    expect(report.steps[2].department).toBe('Distribution Chief');
  });

  it('adapts guidelines for active pending release', () => {
    const answers: PassportAnswers = {
      careerStage: 'Building momentum',
      genre: 'Pop',
      proAffiliation: 'SESAC',
      mlcRegistered: 'Yes',
      distributor: 'TuneCore',
      releaseStatus: 'Mixing or mastering',
      goals: ['Create promotional content', 'Pursue sync licensing opportunities'],
    };

    const report = evaluatePassport(answers);

    expect(report.release.status).toBe('ready');
    expect(report.release.guidelines.some((g) => g.includes('3000 × 3000 px'))).toBe(true);
    expect(report.release.guidelines.some((g) => g.includes('-14 LUFS'))).toBe(true);
    expect(report.steps.some((s) => s.title.includes('Vertical 9:16 Social Cutdowns'))).toBe(true);
    expect(report.steps.some((s) => s.title.includes('One-Stop Sync Licensing'))).toBe(true);
  });
});

describe('ArtistPassportPage Component UI & Navigation Flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('renders Step 0 hero with core hook and badge', () => {
    render(
      <MemoryRouter initialEntries={['/passport']}>
        <ArtistPassportPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/How ready is your/i)).toBeDefined();
    expect(screen.getByText(/People make the music\. Connected Intelligence© handles the business\./i)).toBeDefined();
    expect(screen.getByText(/Start Free Business Audit/i)).toBeDefined();
  });

  it('advances to Step 1 and validates career stage selection', () => {
    render(
      <MemoryRouter initialEntries={['/passport']}>
        <ArtistPassportPage />
      </MemoryRouter>
    );

    // Click Start
    fireEvent.click(screen.getByText(/Start Free Business Audit/i));

    // Now on Section 1
    expect(screen.getByText(/Section 01 \/ Career Stage/i)).toBeDefined();
    expect(screen.getByText(/Where are you currently in your music journey\?/i)).toBeDefined();

    const nextBtn = screen.getByText(/Next Step/i).closest('button');
    expect(nextBtn?.disabled).toBe(true);

    // Select Stage
    fireEvent.click(screen.getByText(/Building momentum/i));
    expect(nextBtn?.disabled).toBe(false);

    // Advance to Section 2
    fireEvent.click(nextBtn!);
    expect(screen.getByText(/Section 02 \/ Musical Focus/i)).toBeDefined();
  });

  it('allows stepping back and maintains previous selections', () => {
    render(
      <MemoryRouter initialEntries={['/passport']}>
        <ArtistPassportPage />
      </MemoryRouter>
    );

    // Step 0 -> Step 1
    fireEvent.click(screen.getByText(/Start Free Business Audit/i));
    fireEvent.click(screen.getByText(/Building momentum/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Now on Step 2
    expect(screen.getByText(/Section 02 \/ Musical Focus/i)).toBeDefined();

    // Step back to Step 1
    fireEvent.click(screen.getByText(/^Back$/i));
    expect(screen.getByText(/Section 01 \/ Career Stage/i)).toBeDefined();

    // Next button should still be enabled because stage is already selected
    const nextBtn = screen.getByText(/Next Step/i).closest('button');
    expect(nextBtn?.disabled).toBe(false);
  });

  it('enforces maximum 2 selected goals and handles toggling', () => {
    render(
      <MemoryRouter initialEntries={['/passport']}>
        <ArtistPassportPage />
      </MemoryRouter>
    );

    // Move to step 5 (Goals)
    fireEvent.click(screen.getByText(/Start Free Business Audit/i));

    // Step 1: Stage
    fireEvent.click(screen.getByText(/Building momentum/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 2: Genre
    fireEvent.click(screen.getByText(/Electronic \/ Dance/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 3: Rights
    fireEvent.click(screen.getByText('ASCAP'));
    fireEvent.click(screen.getByText(/Yes — my compositions are registered with The MLC/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 4: Distribution
    fireEvent.click(screen.getByText('DistroKid'));
    fireEvent.click(screen.getByText(/Audio is in mixing or final mastering stages/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 5: Goals
    expect(screen.getByText(/Section 05 \/ Immediate Priorities/i)).toBeDefined();
    const generateBtn = screen.getByText(/Generate Assessment/i).closest('button');
    expect(generateBtn?.disabled).toBe(true);

    const goal1 = screen.getByText(/Improve royalty registration & collection tracking/i);
    const goal2 = screen.getByText(/Grow fan base, streaming reach & social engagement/i);
    const goal3 = screen.getByText(/Package catalog for film, TV & sync licensing opportunities/i);

    // Select goal 1
    fireEvent.click(goal1);
    expect(generateBtn?.disabled).toBe(false);

    // Select goal 2
    fireEvent.click(goal2);

    // Select goal 3 (replaces second goal due to max 2 limit)
    fireEvent.click(goal3);

    // Toggle off goal 1
    fireEvent.click(goal1);
    expect(generateBtn?.disabled).toBe(false);
  });

  it('handles optional lead capture and restart audit', () => {
    render(
      <MemoryRouter initialEntries={['/passport?source=meta_ads']}>
        <ArtistPassportPage />
      </MemoryRouter>
    );

    // Step 0 -> Step 1
    fireEvent.click(screen.getByText(/Start Free Business Audit/i));

    // Step 1: Stage
    fireEvent.click(screen.getByText(/Building momentum/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 2: Genre
    fireEvent.click(screen.getByText(/Electronic \/ Dance/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 3: Rights
    fireEvent.click(screen.getByText('ASCAP'));
    fireEvent.click(screen.getByText(/No — not registered with The MLC/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 4: Distribution
    fireEvent.click(screen.getByText('DistroKid'));
    fireEvent.click(screen.getByText(/Audio is in mixing or final mastering stages/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 5: Goals
    fireEvent.click(screen.getByText(/Improve royalty registration & collection tracking/i));
    fireEvent.click(screen.getByText(/Generate Assessment/i));

    // Step 6: Diagnostic Report View
    expect(screen.getByText(/Your Artist Business Diagnostic/i)).toBeDefined();

    // Fill in lead capture form
    const nameInput = screen.getByPlaceholderText(/e\.g\. Luna Eclipse/i);
    const emailInput = screen.getByPlaceholderText(/artist@example\.com/i);

    fireEvent.change(nameInput, { target: { value: 'Marcus Rivers' } });
    fireEvent.change(emailInput, { target: { value: 'marcus@example.com' } });

    const sendButton = screen.getByText(/Save Email Copy/i).closest('button');
    fireEvent.click(sendButton!);

    // Should confirm receipt
    expect(screen.getByText(/Your assessment copy request is saved for marcus@example\.com/i)).toBeDefined();

    // Restart audit
    const restartBtn = screen.getByText(/Start Over/i);
    fireEvent.click(restartBtn);

    // Should return to Step 0
    expect(screen.getByText(/How ready is your/i)).toBeDefined();
  });

  it('preserves referral source in signup link handoff', () => {
    render(
      <MemoryRouter initialEntries={['/passport?source=founder_dm']}>
        <ArtistPassportPage />
      </MemoryRouter>
    );

    // Step 0 -> Step 1
    fireEvent.click(screen.getByText(/Start Free Business Audit/i));

    // Step 1: Stage
    fireEvent.click(screen.getByText(/Building momentum/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 2: Genre
    fireEvent.click(screen.getByText(/Electronic \/ Dance/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 3: Rights (PRO + MLC)
    fireEvent.click(screen.getByText('ASCAP'));
    fireEvent.click(screen.getByText(/No — not registered with The MLC/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 4: Distribution & Status
    fireEvent.click(screen.getByText('DistroKid'));
    fireEvent.click(screen.getByText(/Audio is in mixing or final mastering stages/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    // Step 5: Goals
    fireEvent.click(screen.getByText(/Improve royalty registration & collection tracking/i));
    fireEvent.click(screen.getByText(/Generate Assessment/i));

    // Step 6: Gap Report View
    expect(screen.getByText(/Your Artist Business Diagnostic/i)).toBeDefined();
    expect(screen.getByText(/Possible Streaming Mechanical Collection Gap/i)).toBeDefined();

    // Check signup link contains ?source=founder_dm
    const ctaLink = screen.getByText(/Claim Your Artist Passport & Enter Studio/i).closest('a');
    expect(ctaLink?.getAttribute('href')).toContain('source=founder_dm');

    // Check 'Still Not Convinced?' landing page bridge
    expect(screen.getByText(/Still Not Convinced\? See Full Platform & Free Tools/i)).toBeDefined();
    const stillNotConvincedLink = screen.getByText(/Still Not Convinced\? See Full Platform & Free Tools/i).closest('a');
    expect(stillNotConvincedLink?.getAttribute('href')).toContain('from=passport');
    expect(stillNotConvincedLink?.getAttribute('href')).toContain('source=founder_dm');
    expect(stillNotConvincedLink?.getAttribute('href')).toContain('#studio-preview');
  });

  it('renders Step 0 hero with direct test drive hook preserving attribution', () => {
    render(
      <MemoryRouter initialEntries={['/passport?source=tiktok_ad']}>
        <ArtistPassportPage />
      </MemoryRouter>
    );

    const heroTestDriveLink = screen.getByText(/Or Test Drive 1 Track Free/i).closest('a');
    expect(heroTestDriveLink).toBeDefined();
    expect(heroTestDriveLink?.getAttribute('href')).toContain('mode=free_demo&module=creative');
    expect(heroTestDriveLink?.getAttribute('href')).toContain('source=tiktok_ad');
  });

  it('records funnel telemetry events across full user walkthrough', () => {
    sessionStorage.clear();
    render(
      <MemoryRouter initialEntries={['/passport?source=meta_campaign']}>
        <ArtistPassportPage />
      </MemoryRouter>
    );

    // Step 0 -> Step 1
    fireEvent.click(screen.getByText(/Start Free Business Audit/i));

    // Step 1 -> Step 2
    fireEvent.click(screen.getByText(/Building momentum/i));
    fireEvent.click(screen.getByText(/Next Step/i));

    const events = readPassportEventLog();
    const eventNames = events.map((e) => e.eventName);
    expect(eventNames).toContain('passport_viewed');
    expect(eventNames).toContain('passport_started');
    expect(eventNames).toContain('passport_step_completed');
  });
});

