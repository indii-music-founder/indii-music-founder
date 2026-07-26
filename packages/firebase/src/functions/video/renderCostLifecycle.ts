/**
 * A Transcoder submission is an external side effect. Once one may have been
 * accepted, a failed worker cannot honestly call the reservation unused: the
 * provider can continue consuming billable resources after our poll/status
 * update fails. We therefore settle conservatively after a durable submission
 * intent and void only failures that occurred before any submission attempt.
 */
export function renderFailureReservationOutcome(input: {
    transcoderSubmissionAttempted: boolean;
}): 'SETTLED' | 'VOIDED' {
    return input.transcoderSubmissionAttempted ? 'SETTLED' : 'VOIDED';
}
