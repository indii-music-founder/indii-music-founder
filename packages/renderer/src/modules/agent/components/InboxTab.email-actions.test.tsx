import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InboxTab from './InboxTab';
import { useStore } from '@/core/store';
import { EmailService } from '@/services/email/EmailService';
import type { EmailAccount, EmailMessage } from '@/services/email/types';

const { mockShowToast } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
    ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/services/email/EmailService', () => ({
    EmailService: {
        getConnectedAccounts: vi.fn(),
        markAsRead: vi.fn(),
        toggleStar: vi.fn(),
        trashMessage: vi.fn(),
    },
}));

function createAccount(provider: EmailAccount['provider']): EmailAccount {
    return {
        id: `${provider}-account`,
        provider,
        email: `${provider}@example.com`,
        displayName: provider === 'gmail' ? 'Gmail Inbox' : 'Outlook Inbox',
        isConnected: true,
        lastSyncAt: Date.now(),
    };
}

function createMessage(overrides: Partial<EmailMessage> = {}): EmailMessage {
    return {
        id: 'message-1',
        threadId: 'thread-1',
        provider: 'gmail',
        accountId: 'gmail-account',
        from: { name: 'Test Sender', email: 'sender@example.com' },
        to: [{ name: 'Test Recipient', email: 'recipient@example.com' }],
        subject: 'Test subject',
        snippet: 'Test snippet',
        date: Date.now() - 60_000,
        isRead: false,
        isStarred: false,
        isDraft: false,
        labels: [],
        attachments: [],
        providerMessageId: 'provider-message-1',
        ...overrides,
    };
}

function seedInboxState(
    messages: EmailMessage[],
    selectedMessage: EmailMessage | null = null,
    accounts: EmailAccount[] = [createAccount(messages[0]?.provider ?? 'gmail')]
) {
    const state = useStore.getState() as any;

    state.emailAccounts = accounts;
    state.emailMessages = messages;
    state.emailSelectedMessage = selectedMessage;
    state.emailIsLoading = false;
    state.emailIsSyncing = false;
    state.emailIsComposing = false;
    state.emailError = null;
    state.emailSearchQuery = '';
    state.emailFilter = 'all';

    state.emailSetAccounts = vi.fn((next: EmailAccount[]) => {
        state.emailAccounts = next;
    });
    state.emailSetMessages = vi.fn((next: EmailMessage[]) => {
        state.emailMessages = next;
    });
    state.emailAppendMessages = vi.fn((next: EmailMessage[]) => {
        const existingIds = new Set(state.emailMessages.map((message: EmailMessage) => message.id));
        const additions = next.filter((message: EmailMessage) => !existingIds.has(message.id));
        state.emailMessages = [...state.emailMessages, ...additions].sort((a: EmailMessage, b: EmailMessage) => b.date - a.date);
    });
    state.emailSelectMessage = vi.fn((next: EmailMessage | null) => {
        state.emailSelectedMessage = next;
    });
    state.emailSetLoading = vi.fn((loading: boolean) => {
        state.emailIsLoading = loading;
    });
    state.emailSetSyncing = vi.fn((syncing: boolean) => {
        state.emailIsSyncing = syncing;
    });
    state.emailSetComposing = vi.fn((composing: boolean) => {
        state.emailIsComposing = composing;
    });
    state.emailSetError = vi.fn((error: string | null) => {
        state.emailError = error;
    });
    state.emailSetSearchQuery = vi.fn((query: string) => {
        state.emailSearchQuery = query;
    });
    state.emailSetFilter = vi.fn((filter: 'all' | 'unread' | 'starred') => {
        state.emailFilter = filter;
    });
    state.emailMarkAsRead = vi.fn((messageId: string) => {
        state.emailMessages = state.emailMessages.map((message: EmailMessage) =>
            message.id === messageId ? { ...message, isRead: true } : message
        );
        if (state.emailSelectedMessage?.id === messageId) {
            state.emailSelectedMessage = { ...state.emailSelectedMessage, isRead: true };
        }
    });
    state.emailToggleStar = vi.fn((messageId: string) => {
        state.emailMessages = state.emailMessages.map((message: EmailMessage) =>
            message.id === messageId ? { ...message, isStarred: !message.isStarred } : message
        );
        if (state.emailSelectedMessage?.id === messageId) {
            state.emailSelectedMessage = {
                ...state.emailSelectedMessage,
                isStarred: !state.emailSelectedMessage.isStarred,
            };
        }
    });
    state.emailRemoveMessage = vi.fn((messageId: string) => {
        state.emailMessages = state.emailMessages.filter((message: EmailMessage) => message.id !== messageId);
        if (state.emailSelectedMessage?.id === messageId) {
            state.emailSelectedMessage = null;
        }
    });
    state.emailUpdateMessage = vi.fn((messageId: string, updates: Partial<EmailMessage>) => {
        state.emailMessages = state.emailMessages.map((message: EmailMessage) =>
            message.id === messageId ? { ...message, ...updates } : message
        );
        if (state.emailSelectedMessage?.id === messageId) {
            state.emailSelectedMessage = { ...state.emailSelectedMessage, ...updates };
        }
    });
    state.emailUnreadCount = vi.fn(() => state.emailMessages.filter((message: EmailMessage) => !message.isRead).length);
    state.emailFilteredMessages = vi.fn(() => state.emailMessages);
    state.emailConnect = vi.fn().mockResolvedValue(undefined);
    state.emailDisconnect = vi.fn().mockResolvedValue(undefined);
    state.emailSync = vi.fn().mockResolvedValue(undefined);
    state.emailSend = vi.fn().mockResolvedValue(true);
}

describe('InboxTab email actions', () => {
    beforeEach(() => {
        mockShowToast.mockReset();
        vi.mocked(EmailService.getConnectedAccounts).mockReset();
        vi.mocked(EmailService.markAsRead).mockReset();
        vi.mocked(EmailService.toggleStar).mockReset();
        vi.mocked(EmailService.trashMessage).mockReset();
    });

    it('reverts star state when the provider rejects the toggle', async () => {
        const message = createMessage({ id: 'gmail-message-1', provider: 'gmail', accountId: 'gmail-account' });
        const user = userEvent.setup();

        seedInboxState([message]);
        vi.mocked(EmailService.getConnectedAccounts).mockResolvedValue([createAccount('gmail')]);
        vi.mocked(EmailService.toggleStar).mockRejectedValueOnce(new Error('Gmail toggle failed'));

        render(<InboxTab />);

        await waitFor(() => expect(EmailService.getConnectedAccounts).toHaveBeenCalledTimes(1));
        await user.click(screen.getByTitle('Star'));

        await waitFor(() => expect(EmailService.toggleStar).toHaveBeenCalledWith('gmail', 'provider-message-1', true));
        expect((useStore.getState() as any).emailMessages[0].isStarred).toBe(false);
        expect((useStore.getState() as any).emailToggleStar).toHaveBeenCalledTimes(2);
        expect(mockShowToast).toHaveBeenCalledWith('Failed to update star', 'error');
    });

    it('restores the message when trash fails after optimistic removal', async () => {
        const message = createMessage({
            id: 'outlook-message-1',
            provider: 'outlook',
            accountId: 'outlook-account',
            isRead: true,
            bodyText: 'Full message body',
            snippet: 'Full message body',
        });
        const user = userEvent.setup();

        seedInboxState([message], message, [createAccount('outlook')]);
        vi.mocked(EmailService.getConnectedAccounts).mockResolvedValue([createAccount('outlook')]);
        vi.mocked(EmailService.trashMessage).mockRejectedValueOnce(new Error('Outlook trash failed'));

        render(<InboxTab />);

        await waitFor(() => expect(EmailService.getConnectedAccounts).toHaveBeenCalledTimes(1));
        await user.click(screen.getByTitle('Trash'));

        await waitFor(() => expect(EmailService.trashMessage).toHaveBeenCalledWith('outlook', 'provider-message-1'));
        const state = useStore.getState() as any;
        expect(state.emailMessages).toHaveLength(1);
        expect(state.emailSelectedMessage?.id).toBe('outlook-message-1');
        expect(state.emailRemoveMessage).toHaveBeenCalledTimes(1);
        expect(state.emailAppendMessages).toHaveBeenCalledTimes(1);
        expect(mockShowToast).toHaveBeenCalledWith('Failed to trash message', 'error');
    });

    it('reverts unread state when marking a message as read fails', async () => {
        const message = createMessage({ id: 'gmail-message-2', provider: 'gmail', accountId: 'gmail-account', isRead: false });
        const user = userEvent.setup();

        seedInboxState([message]);
        vi.mocked(EmailService.getConnectedAccounts).mockResolvedValue([createAccount('gmail')]);
        vi.mocked(EmailService.markAsRead).mockRejectedValueOnce(new Error('Gmail mark-as-read failed'));

        render(<InboxTab />);

        await waitFor(() => expect(EmailService.getConnectedAccounts).toHaveBeenCalledTimes(1));
        await user.click(screen.getByText('Test subject'));

        await waitFor(() => expect(EmailService.markAsRead).toHaveBeenCalledWith('gmail', 'provider-message-1'));
        const state = useStore.getState() as any;
        expect(state.emailMessages[0].isRead).toBe(false);
        expect(state.emailUpdateMessage).toHaveBeenCalledWith('gmail-message-2', { isRead: false });
        expect(mockShowToast).toHaveBeenCalledWith('Failed to mark message as read', 'error');
    });
});
