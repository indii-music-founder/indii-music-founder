/**
 * ISSUE-1707: every awaited step of release submission gets a deadline, so the
 * wizard can name the step that stalled instead of showing "Submitting" forever
 * (a live run sat on the spinner for 8+ minutes after the server had already
 * marked the release metadata_complete).
 */
export class SubmitStepTimeoutError extends Error {
    readonly step: string;
    constructor(step: string, ms: number) {
        super(`"${step}" is taking longer than expected (over ${Math.round(ms / 1000)} seconds).`);
        this.name = 'SubmitStepTimeoutError';
        this.step = step;
    }
}

export function withStepDeadline<T>(step: string, ms: number, work: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new SubmitStepTimeoutError(step, ms)), ms);
        work.then(
            value => { clearTimeout(timer); resolve(value); },
            error => { clearTimeout(timer); reject(error); },
        );
    });
}
