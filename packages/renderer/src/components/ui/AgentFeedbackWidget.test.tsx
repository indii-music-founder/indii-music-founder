import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentFeedbackWidget } from './AgentFeedbackWidget';

const feedback = vi.hoisted(() => ({
    submit: vi.fn(),
    close: vi.fn(),
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
        isFeedbackWidgetOpen: true,
        currentFeedbackContext: { agentId: 'marketing', actionType: 'campaign_plan', contentSummary: 'Launch idea' },
        closeFeedbackWidget: feedback.close,
        submitFeedback: feedback.submit,
    }),
}));

describe('AgentFeedbackWidget', () => {
    beforeEach(() => vi.clearAllMocks());

    it('requires a correction and keeps it visible when storage fails', async () => {
        feedback.submit.mockResolvedValue(false);
        render(<AgentFeedbackWidget />);

        fireEvent.click(screen.getByRole('button', { name: 'Correct Agent' }));
        expect(screen.queryByText('Share anonymized rule to Wisdom Pool')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Save Feedback' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Describe what the agent should change');
        expect(feedback.submit).not.toHaveBeenCalled();

        fireEvent.change(screen.getByRole('textbox', { name: 'What should the agent learn?' }), {
            target: { value: 'Avoid sponsored posts' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save Feedback' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Feedback was not saved');
        expect(feedback.submit).toHaveBeenCalledWith('negative', 'Avoid sponsored posts');
        expect(screen.getByRole('textbox', { name: 'What should the agent learn?' })).toHaveValue('Avoid sponsored posts');
    });
});
