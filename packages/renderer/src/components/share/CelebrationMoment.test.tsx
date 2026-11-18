import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const { mockShareSheet } = vi.hoisted(() => ({ mockShareSheet: vi.fn() }));
vi.mock('./ShareSheet', () => ({ ShareSheet: { call: mockShareSheet } }));

import { CelebrationMoment } from './CelebrationMoment';

describe('CelebrationMoment', () => {
    beforeEach(() => {
        window.localStorage.clear();
        mockShareSheet.mockReset();
    });

    it('shows the milestone and hands the card to the ShareSheet on "Share it"', async () => {
        render(<CelebrationMoment />);
        let result: Promise<string> | undefined;
        act(() => {
            result = CelebrationMoment.call({
                headline: 'First release delivered',
                detail: '“Glass Rain” is on its way to every store.',
                template: { kind: 'release', trackTitle: 'Glass Rain' },
            });
        });
        expect(await screen.findByRole('heading', { name: 'First release delivered' })).toBeTruthy();
        expect(screen.getByText('“Glass Rain” is on its way to every store.')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /Share it/ }));
        await expect(result).resolves.toBe('shared');
        expect(mockShareSheet).toHaveBeenCalledWith(expect.objectContaining({ template: { kind: 'release', trackTitle: 'Glass Rain' } }));
    });

    it('resolves "dismissed" on Not now and remembers the sound toggle', async () => {
        render(<CelebrationMoment />);
        let result: Promise<string> | undefined;
        act(() => {
            result = CelebrationMoment.call({ headline: 'First track analyzed', template: { kind: 'milestone', headline: 'First track analyzed' } });
        });
        const sound = await screen.findByRole('button', { name: 'Turn milestone sound on' });
        expect(sound.getAttribute('aria-pressed')).toBe('false');
        fireEvent.click(sound);
        expect(window.localStorage.getItem('indii:milestone-sound')).toBe('on');

        fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
        await expect(result).resolves.toBe('dismissed');
        expect(mockShareSheet).not.toHaveBeenCalled();
    });
});
