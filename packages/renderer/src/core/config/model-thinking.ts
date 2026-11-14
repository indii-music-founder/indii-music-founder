/** Request-shape metadata only: this does not approve a model for dispatch.
 * Candidate models still require server admission, pricing, access, and evaluation.
 */
export const MODEL_THINKING_LEVELS: Readonly<Partial<Record<string, readonly string[]>>> = {
    'gemini-4-argon': ['LOW', 'MEDIUM', 'HIGH'],
    'gemini-4-carbon': ['LOW', 'MEDIUM', 'HIGH'],
    'gemini-4-hydrogen': ['LOW', 'MEDIUM', 'HIGH', 'XHIGH'],
};
