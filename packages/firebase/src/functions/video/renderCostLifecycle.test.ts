import { describe, expect, it } from 'vitest';

import { providerFailureReservationOutcome, renderFailureReservationOutcome } from './renderCostLifecycle';

describe('renderFailureReservationOutcome', () => {
    it('voids a reservation only when failure preceded every Transcoder submission attempt', () => {
        expect(renderFailureReservationOutcome({ transcoderSubmissionAttempted: false })).toBe('VOIDED');
    });

    it('settles conservatively after a Transcoder submission may have reached the provider', () => {
        expect(renderFailureReservationOutcome({ transcoderSubmissionAttempted: true })).toBe('SETTLED');
    });

    it('uses the same conservative outcome for a Vertex request that may have been accepted', () => {
        expect(providerFailureReservationOutcome({ providerSubmissionAttempted: false })).toBe('VOIDED');
        expect(providerFailureReservationOutcome({ providerSubmissionAttempted: true })).toBe('SETTLED');
    });
});
