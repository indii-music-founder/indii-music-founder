import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../firebase', () => ({
  getAdminToken: vi.fn(async () => 'admin-test-token'),
}));

import { ProspectsPanel } from './ProspectsPanel';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

const mockProspectsData = {
  summary: {
    totalAssessments: 2,
    emailCapturedCount: 1,
    assessmentCopyRequestedCount: 1,
    claimedAccountCount: 1,
    rightsGapsCount: 2,
    conversionRates: {
      emailCaptureRate: 50,
      copyRequestRate: 50,
      accountClaimRate: 50,
      rightsGapRate: 100,
    },
    channelAttribution: {
      passport_organic: {
        total: 2,
        emails: 1,
        copyRequested: 1,
        claimed: 1,
        rightsGaps: 2,
      },
    },
  },
  prospects: [
    {
      id: 'asmt-1',
      createdAt: '2026-09-01T12:00:00.000Z',
      updatedAt: '2026-09-01T12:00:00.000Z',
      clientSessionId: 'sess-1',
      artistName: 'Luna Wave',
      email: 'luna@example.com',
      hasEmail: true,
      careerStage: 'developing',
      genre: 'Electronic / Dance',
      proAffiliation: 'BMI',
      mlcRegistered: 'No',
      distributor: 'DistroKid',
      releaseStatus: 'Ready in 30 days',
      goals: ['Direct-to-fan distribution', 'Collect mechanicals'],
      marketingConsent: true,
      assessmentConsent: true,
      claimedByUid: 'uid-luna-123',
      claimedAt: '2026-09-01T12:05:00.000Z',
      source: 'passport_organic',
      rightsGaps: ['Unregistered with The MLC'],
      followUpStatus: 'not_contacted',
      lastContactedAt: null,
      contactCount: 0,
      notes: 'Excited about stem mastering',
    },
    {
      id: 'asmt-2',
      createdAt: '2026-09-02T14:00:00.000Z',
      updatedAt: '2026-09-02T14:00:00.000Z',
      clientSessionId: 'sess-2',
      artistName: null,
      email: null,
      hasEmail: false,
      careerStage: 'emerging',
      genre: 'Hip-Hop / Rap',
      proAffiliation: 'None',
      mlcRegistered: 'Unsure',
      distributor: 'None',
      releaseStatus: 'Actively recording',
      goals: ['Protect rights'],
      marketingConsent: false,
      assessmentConsent: false,
      claimedByUid: null,
      claimedAt: null,
      source: 'passport_organic',
      rightsGaps: ['No PRO Affiliation', 'Unregistered with The MLC', 'No Active Distributor'],
      followUpStatus: 'not_contacted',
      lastContactedAt: null,
      contactCount: 0,
      notes: '',
    },
  ],
};

describe('ProspectsPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows admin authentication required notice when endpoint returns 401', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 401));
    render(<ProspectsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Admin authentication required/i)).toBeDefined();
    });
  });

  it('shows error notice when server returns a 500 error', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500));
    render(<ProspectsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Couldn't load prospect assessments/i)).toBeDefined();
    });
  });

  it('renders real prospect leads, summary metrics, and rights gaps', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(mockProspectsData));
    render(<ProspectsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Luna Wave')).toBeDefined();
    });

    // Check metric cards
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1); // Total assessments & rights gaps
    expect(screen.getByText('luna@example.com')).toBeDefined();
    expect(screen.getAllByText('Copy Requested').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Electronic / Dance')).toBeDefined();
    expect(screen.getByText('Claimed Member')).toBeDefined();
    expect(screen.getByText('Unclaimed Lead')).toBeDefined();

    // Verify token header in request
    expect(fetch).toHaveBeenCalledWith(
      '/api/prospects',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer admin-test-token',
        }),
      }),
    );
  });

  it('filters by email provided or copy requested', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(mockProspectsData));
    render(<ProspectsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Luna Wave')).toBeDefined();
    });

    // Both visible initially (Luna Wave and Anonymous)
    expect(screen.getByText('Luna Wave')).toBeDefined();
    expect(screen.getByText(/Anonymous Artist/i)).toBeDefined();

    // Click "Copy Requested" filter
    const copyRequestedTab = screen.getByRole('button', { name: /Copy Requested/i });
    fireEvent.click(copyRequestedTab);

    // Only Luna Wave requested copy
    expect(screen.getByText('Luna Wave')).toBeDefined();
    expect(screen.queryByText(/Anonymous Artist/i)).toBeNull();
  });

  it('opens CRM detail modal and saves updated founder notes', async () => {
    vi.mocked(fetch).mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/prospects/notes')) {
        return jsonResponse({ success: true });
      }
      if (urlStr.includes('/api/waitlist/artist/history')) {
        return jsonResponse({ communications: [], notes: 'Excited about stem mastering' });
      }
      return jsonResponse(mockProspectsData);
    });

    render(<ProspectsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Luna Wave')).toBeDefined();
    });

    // Click CRM button for Luna Wave
    const crmBtn = screen.getAllByTitle('View diagnostic details & private CRM notes')[0];
    fireEvent.click(crmBtn);

    // Check modal opened with diagnostic profile details
    await waitFor(() => {
      expect(screen.getByText(/Diagnostic Profile/i)).toBeDefined();
    });
    expect(screen.getAllByText('DistroKid').length).toBeGreaterThanOrEqual(1);

    // Type notes and click Save Notes
    const notesInput = screen.getByPlaceholderText(/Write private founder observations/i);
    fireEvent.change(notesInput, { target: { value: 'Spoke on Discord about direct licensing' } });

    const saveNotesBtn = screen.getByRole('button', { name: /Save Notes/i });
    fireEvent.click(saveNotesBtn);

    await waitFor(() => {
      expect(screen.getByText(/Notes and follow-up status updated/i)).toBeDefined();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/prospects/notes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          assessmentId: 'asmt-1',
          email: 'luna@example.com',
          notes: 'Spoke on Discord about direct licensing',
          followUpStatus: 'not_contacted',
        }),
      }),
    );
  });

  it('opens direct email outreach modal with pre-filled diagnostic answers', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(mockProspectsData));
    render(<ProspectsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Luna Wave')).toBeDefined();
    });

    // Click Email button for Luna Wave
    const emailBtn = screen.getByTitle('Direct email to luna@example.com');
    fireEvent.click(emailBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText(/Direct Email Outreach/i)).toBeDefined();
    });
    expect(screen.getAllByText('luna@example.com').length).toBeGreaterThanOrEqual(1);

    // Body contains Luna's answers
    const bodyInput = screen.getByPlaceholderText(/Write your email message/i) as HTMLTextAreaElement;
    expect(bodyInput.value).toContain('Luna Wave');
    expect(bodyInput.value).toContain('Electronic / Dance');
    expect(bodyInput.value).toContain('DistroKid');
  });

  it('switches to Unit Economics & ROI tab, runs simulator, and displays CAC/LTV multipliers', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(mockProspectsData));
    render(<ProspectsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Luna Wave')).toBeDefined();
    });

    // Click Unit Economics & ROI tab
    const unitEconTabBtn = screen.getByRole('button', { name: /Unit Economics & ROI/i });
    fireEvent.click(unitEconTabBtn);

    // Verify simulator renders
    await waitFor(() => {
      expect(screen.getByText(/Customer Acquisition Cost \(CAC\) & Unit Economics Simulator/i)).toBeDefined();
    });

    // Default spend $500:
    // CPD = 500 / 2 = $250.00
    // CPL = 500 / 1 = $500.00
    // Blended CAC = 500 / 1 = $500.00
    // Start Tier LTV ratio = 264 / 500 = 0.5x
    expect(screen.getByText('$250.00')).toBeDefined();
    expect(screen.getAllByText('$500.00').length).toBeGreaterThanOrEqual(1);

    // Click $250 preset button
    const preset250 = screen.getByRole('button', { name: '$250' });
    fireEvent.click(preset250);

    // CPD should now be 250 / 2 = $125.00
    await waitFor(() => {
      expect(screen.getByText('$125.00')).toBeDefined();
    });

    // Verify channel attribution source renders
    expect(screen.getByText('passport_organic')).toBeDefined();

    // Verify Funnel Waterfall renders
    expect(screen.getByText(/Funnel Drop-Off & Conversion Waterfall/i)).toBeDefined();
  });

  it('copies formatted investor memo to clipboard when button clicked', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(mockProspectsData));
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<ProspectsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Luna Wave')).toBeDefined();
    });

    // Switch to Unit Economics
    fireEvent.click(screen.getByRole('button', { name: /Unit Economics & ROI/i }));

    const copyBtn = screen.getByRole('button', { name: /Copy Investor Memo/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
    });

    const memoContent = writeTextMock.mock.calls[0][0] as string;
    expect(memoContent).toContain('indii.music — Artist Passport Unit Economics & Acquisition ROI');
    expect(memoContent).toContain('Modeled Marketing Spend: $500');
    expect(memoContent).toContain('Total Completed Diagnostics: 2');
    expect(memoContent).toContain('Leads Captured (Emails): 1');
  });
});
