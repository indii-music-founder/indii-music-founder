import type { Page } from '@playwright/test';

/**
 * The shared fixture answers TypeSafe `typesafeJudge` questions generically:
 * `intent` is always `discussion` (keeps the Boardroom read-only, so no tools run)
 * and unknown questions get `allow` (not a valid specialist route, so routing falls
 * back to the Conductor). Specs that exercise a Boardroom *action* declare the
 * answers the real judge would give for their request. A request whose questions
 * include none of the declared keys falls through to the fixture. Registered after
 * the fixture, so it takes precedence.
 */
export interface JudgeAnswers {
    /** Boardroom intent: `discussion` | `capability` | `action`. */
    intent?: 'discussion' | 'capability' | 'action';
    /** Specialist route (judgeSpecialistAgentRoute), e.g. `publicist`. */
    specialist?: string;
}

export async function answerJudgeQuestions(page: Page, declared: JudgeAnswers): Promise<void> {
    await page.route('**/typesafeJudge', async (route) => {
        let body: { data?: { questions?: Record<string, unknown> }; questions?: Record<string, unknown> } = {};
        try { body = JSON.parse(route.request().postData() || '{}'); } catch { /* fall through */ }
        const questions = body.data?.questions ?? body.questions ?? {};
        const keys = Object.keys(questions);
        if (!keys.some((key) => key in declared)) {
            await route.fallback();
            return;
        }
        const answers: Record<string, unknown> = {};
        for (const key of keys) {
            const choice = key === 'intent' ? declared.intent
                : key === 'specialist' ? declared.specialist
                    : key === 'corpus' ? 'general'
                        : key === 'complexity' ? 'simple' : 'allow';
            // Real judge answers carry the question type; route parsing requires it.
            answers[key] = { type: 'choice', choice, confidence: 0.95 };
        }
        await route.fulfill({
            status: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            contentType: 'application/json',
            body: JSON.stringify({ data: { answers } }),
        });
    });
}
