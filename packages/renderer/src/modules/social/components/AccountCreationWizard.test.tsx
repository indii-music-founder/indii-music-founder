import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    clipboardWrite: vi.fn(),
    getState: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => ({ error: mocks.toastError, success: mocks.toastSuccess }) }));
vi.mock('@/core/store', () => {
    const useStore = Object.assign(vi.fn(), { getState: mocks.getState });
    return { useStore };
});
vi.mock('../../creative/components/BrandAssetsDrawer', () => ({ default: () => null }));

import AccountCreationWizard from './AccountCreationWizard';

const draftKey = 'indii:social-account-setup:user-1:project-1';

function writeDraft(imageUrl: string, transferredAssetUrls: string[] = []) {
    window.localStorage.setItem(draftKey, JSON.stringify({
        step: 4,
        platformName: 'Instagram',
        brandName: 'Indii',
        industry: 'Music',
        generatedIdentity: null,
        profileImage: { assetType: 'image', title: 'Profile', imageUrl, caption: '' },
        bannerImage: null,
        transferredAssetUrls,
    }));
}

describe('AccountCreationWizard asset handoff (ISSUE-1013)', () => {
    beforeEach(() => {
        window.localStorage.clear();
        mocks.clipboardWrite.mockReset().mockResolvedValue(undefined);
        mocks.getState.mockReturnValue({ userProfile: { id: 'user-1' }, currentProjectId: 'project-1' });
        Object.assign(navigator, { clipboard: { writeText: mocks.clipboardWrite } });
    });

    it('restores a project-scoped draft and requires an explicit asset transfer before readiness', async () => {
        writeDraft('https://assets.example.test/profile.png');
        render(<AccountCreationWizard onClose={vi.fn()} />);

        expect(screen.getByText('Finish asset handoff')).toBeTruthy();
        expect(screen.getByText('Choose Download, Open, or Copy link to mark this asset ready for transfer.')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

        await waitFor(() => expect(screen.getByText('Ready to Create!')).toBeTruthy());
        expect(mocks.clipboardWrite).toHaveBeenCalledWith('https://assets.example.test/profile.png');
        expect(JSON.parse(window.localStorage.getItem(draftKey) || '{}').transferredAssetUrls)
            .toEqual(['https://assets.example.test/profile.png']);
    });

    it('keeps an inaccessible restored asset in a repair state instead of claiming readiness', () => {
        writeDraft('gs://private-bucket/expired-profile.png');
        render(<AccountCreationWizard onClose={vi.fn()} />);

        expect(screen.getByText('Finish asset handoff')).toBeTruthy();
        expect(screen.getByText('Unavailable — return to step 3 and choose this asset again.')).toBeTruthy();
        expect(screen.queryByText('Ready to Create!')).toBeNull();
    });
});
