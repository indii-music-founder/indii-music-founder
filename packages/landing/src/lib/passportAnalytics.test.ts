import { describe, expect, it, vi, beforeEach } from 'vitest';
import { trackPassportEvent, getPassportSessionId, readPassportEventLog } from './passportAnalytics';

describe('passportAnalytics', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        delete window.gtag;
        delete window.fbq;
        vi.clearAllMocks();
    });

    it('generates and persists a stable passport session ID', () => {
        const id1 = getPassportSessionId();
        const id2 = getPassportSessionId();
        expect(id1).toBeTruthy();
        expect(id1).toBe(id2);
        expect(id1.startsWith('pp-')).toBe(true);
    });

    it('tracks passport events to local sessionStorage event log', () => {
        const record = trackPassportEvent('passport_started', { entryPoint: 'hero_card' }, 'asmt-123');

        expect(record.eventName).toBe('passport_started');
        expect(record.assessmentId).toBe('asmt-123');
        expect(record.details).toEqual({ entryPoint: 'hero_card' });

        const log = readPassportEventLog();
        expect(log.length).toBe(1);
        expect(log[0].eventName).toBe('passport_started');
    });

    it('forwards events to window.gtag and window.fbq if defined', () => {
        const mockGtag = vi.fn();
        const mockFbq = vi.fn();
        window.gtag = mockGtag;
        window.fbq = mockFbq;

        trackPassportEvent('lead_submitted', { emailProvided: true }, 'asmt-456');

        expect(mockGtag).toHaveBeenCalledWith(
            'event',
            'lead_submitted',
            expect.objectContaining({
                event_category: 'artist_passport',
                event_label: 'asmt-456',
                emailProvided: true,
            })
        );

        expect(mockFbq).toHaveBeenCalledWith(
            'trackCustom',
            'lead_submitted',
            expect.objectContaining({
                assessmentId: 'asmt-456',
                emailProvided: true,
            })
        );
    });
});
