/** Persona verdicts may measure advisory style, but must never replace a completed deliverable. */
export function preserveCompletedResponse(completedText: string, styledText: string): {
    text: string;
    measurementMatchesDisplayedText: boolean;
} {
    return { text: completedText, measurementMatchesDisplayedText: completedText === styledText };
}
