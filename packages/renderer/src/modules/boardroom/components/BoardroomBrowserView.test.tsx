import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardroomBrowserView } from './BoardroomBrowserView';

const mocks = vi.hoisted(() => ({ judge: vi.fn(), add: vi.fn(), navigate: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), url: 'https://artists.spotify.com' }));
vi.mock('@/config/typesafeJudgments', () => ({ judgeBoardroomWebpageSemantics: mocks.judge }));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => ({ success: mocks.success, error: mocks.error, info: mocks.info }) }));
vi.mock('@/core/store', () => ({ useStore: (selector: (state: unknown) => unknown) => selector({
    boardroomBrowserUrl: mocks.url, setBoardroomBrowserUrl: mocks.navigate,
    addReferencedAsset: mocks.add, activeAgents: [], toggleAgent: vi.fn(),
}) }));

const fallback = { category: 'dsp', categoryLabel: 'DSP', recommendedDepartment: 'distribution', relevanceScore: 0.9, source: 'deterministic' };

describe('Boardroom page classification', () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.url = 'https://artists.spotify.com'; mocks.judge.mockResolvedValue(fallback); });
    afterEach(() => { vi.unstubAllGlobals(); });
    it('does not reattach the native browser when its URL changes', () => {
        const attach = vi.fn().mockResolvedValue({ success: true });
        const unsubscribe = vi.fn();
        const setBounds = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
        vi.stubGlobal('electronAPI', { boardroomBrowser: {
            attach, setBounds, onStateChange: vi.fn(() => unsubscribe),
        } });
        const view = render(<BoardroomBrowserView />);
        expect(attach).toHaveBeenCalledTimes(1);
        mocks.url = 'https://members.ascap.com';
        view.rerender(<BoardroomBrowserView />);
        expect(attach).toHaveBeenCalledTimes(1);
        expect(unsubscribe).not.toHaveBeenCalled();
        view.unmount();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('shows native page failures and prevents pinning until the page recovers', async () => {
        let onState!: (state: { url: string; title: string; isLoading: boolean; canGoBack: boolean; canGoForward: boolean; error: string | null }) => void;
        vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
        vi.stubGlobal('electronAPI', { boardroomBrowser: {
            attach: vi.fn().mockResolvedValue({ success: true }), setBounds: vi.fn(),
            onStateChange: (callback: typeof onState) => { onState = callback; return vi.fn(); },
        } });
        render(<BoardroomBrowserView />);
        act(() => onState({ url: 'https://artists.spotify.com', title: '', isLoading: false, canGoBack: false, canGoForward: false, error: 'load failed' }));
        expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded');
        expect(screen.getByTestId('boardroom-browser-pin-btn')).toBeDisabled();
        act(() => onState({ url: 'https://artists.spotify.com', title: '', isLoading: false, canGoBack: false, canGoForward: false, error: null }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByTestId('boardroom-browser-pin-btn')).toBeEnabled();
    });

    it('labels fallback honestly and removes it on navigation', async () => {
        render(<BoardroomBrowserView />);
        fireEvent.click(screen.getByTestId('boardroom-browser-pin-btn'));
        expect(await screen.findByText('Automatic suggestion:')).toBeInTheDocument();
        expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.stringContaining('Page text was not captured') }));
        expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining('text could not be captured'));
        expect(mocks.success).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /ASCAP Portal/i }));
        expect(screen.queryByTestId('boardroom-browser-jev-badge')).not.toBeInTheDocument();
    });
    it('reports an unavailable reader instead of claiming extraction succeeded', () => {
        render(<BoardroomBrowserView />);
        fireEvent.click(screen.getByRole('button', { name: 'Reader mode' }));
        expect(mocks.error).toHaveBeenCalledWith('Could not extract text for reader mode.');
    });
    it('discards reader content that arrives after navigation', async () => {
        let complete!: (result: unknown) => void;
        const extractWebPage = vi.fn(() => new Promise(resolve => { complete = resolve; }));
        vi.stubGlobal('electronAPI', { agent: { extractWebPage } });
        render(<BoardroomBrowserView />);
        fireEvent.click(screen.getByRole('button', { name: 'Reader mode' }));
        await waitFor(() => expect(extractWebPage).toHaveBeenCalled());
        fireEvent.click(screen.getByRole('button', { name: /ASCAP Portal/i }));
        await act(async () => { complete({ success: true, data: { title: 'Old page', text: 'Old page content' } }); });
        expect(screen.queryByText('Old page content')).not.toBeInTheDocument();
        expect(screen.queryByText('Old page')).not.toBeInTheDocument();
    });

    it('does not pin or display a classification that completes after navigation', async () => {
        let complete!: (value: typeof fallback) => void;
        mocks.judge.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
        render(<BoardroomBrowserView />);
        fireEvent.click(screen.getByTestId('boardroom-browser-pin-btn'));
        await waitFor(() => expect(mocks.judge).toHaveBeenCalled());
        fireEvent.click(screen.getByRole('button', { name: /ASCAP Portal/i }));
        await act(async () => { complete(fallback); });
        expect(mocks.navigate).toHaveBeenCalled();
        expect(mocks.add).not.toHaveBeenCalled();
        expect(screen.queryByTestId('boardroom-browser-jev-badge')).not.toBeInTheDocument();
    });
});
