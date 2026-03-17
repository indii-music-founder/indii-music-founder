import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';
import type { EmailAccount, EmailMessage, EmailProvider, ComposeEmailData } from '@/services/email/types';

// ---------------------------------------------------------------------------
// Slice Interface
// ---------------------------------------------------------------------------

export interface EmailSlice {
    // State
    emailAccounts: EmailAccount[];
    emailMessages: EmailMessage[];
    emailSelectedMessage: EmailMessage | null;
    emailIsLoading: boolean;
    emailIsSyncing: boolean;
    emailIsComposing: boolean;
    emailError: string | null;
    emailSearchQuery: string;
    emailFilter: 'all' | 'unread' | 'starred';

    // Actions
    emailSetAccounts: (accounts: EmailAccount[]) => void;
    emailSetMessages: (messages: EmailMessage[]) => void;
    emailAppendMessages: (messages: EmailMessage[]) => void;
    emailSelectMessage: (message: EmailMessage | null) => void;
    emailSetLoading: (loading: boolean) => void;
    emailSetSyncing: (syncing: boolean) => void;
    emailSetComposing: (composing: boolean) => void;
    emailSetError: (error: string | null) => void;
    emailSetSearchQuery: (query: string) => void;
    emailSetFilter: (filter: 'all' | 'unread' | 'starred') => void;
    emailMarkAsRead: (messageId: string) => void;
    emailToggleStar: (messageId: string) => void;
    emailRemoveMessage: (messageId: string) => void;
    emailUpdateMessage: (messageId: string, updates: Partial<EmailMessage>) => void;

    // Derived
    emailUnreadCount: () => number;
    emailFilteredMessages: () => EmailMessage[];

    // Async Actions (trigger service calls)
    emailConnect: (provider: EmailProvider) => Promise<void>;
    emailDisconnect: (provider: EmailProvider) => Promise<void>;
    emailSync: (provider?: EmailProvider) => Promise<void>;
    emailSend: (data: ComposeEmailData) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Slice Implementation
// ---------------------------------------------------------------------------

export const createEmailSlice: StateCreator<EmailSlice> = (set, get) => ({
    // Initial state
    emailAccounts: [],
    emailMessages: [],
    emailSelectedMessage: null,
    emailIsLoading: false,
    emailIsSyncing: false,
    emailIsComposing: false,
    emailError: null,
    emailSearchQuery: '',
    emailFilter: 'all',

    // Setters
    emailSetAccounts: (accounts) => set({ emailAccounts: accounts }),
    emailSetMessages: (messages) => set({ emailMessages: messages }),
    emailAppendMessages: (messages) => set((state) => {
        // Deduplicate by ID
        const existingIds = new Set(state.emailMessages.map(m => m.id));
        const newMessages = messages.filter(m => !existingIds.has(m.id));
        return {
            emailMessages: [...state.emailMessages, ...newMessages].sort((a, b) => b.date - a.date),
        };
    }),
    emailSelectMessage: (message) => set({ emailSelectedMessage: message }),
    emailSetLoading: (loading) => set({ emailIsLoading: loading }),
    emailSetSyncing: (syncing) => set({ emailIsSyncing: syncing }),
    emailSetComposing: (composing) => set({ emailIsComposing: composing }),
    emailSetError: (error) => set({ emailError: error }),
    emailSetSearchQuery: (query) => set({ emailSearchQuery: query }),
    emailSetFilter: (filter) => set({ emailFilter: filter }),

    emailMarkAsRead: (messageId) => set((state) => ({
        emailMessages: state.emailMessages.map(m =>
            m.id === messageId ? { ...m, isRead: true } : m
        ),
    })),

    emailToggleStar: (messageId) => set((state) => ({
        emailMessages: state.emailMessages.map(m =>
            m.id === messageId ? { ...m, isStarred: !m.isStarred } : m
        ),
    })),

    emailRemoveMessage: (messageId) => set((state) => ({
        emailMessages: state.emailMessages.filter(m => m.id !== messageId),
        emailSelectedMessage:
            state.emailSelectedMessage?.id === messageId ? null : state.emailSelectedMessage,
    })),

    emailUpdateMessage: (messageId, updates) => set((state) => ({
        emailMessages: state.emailMessages.map(m =>
            m.id === messageId ? { ...m, ...updates } : m
        ),
    })),

    // Derived values
    emailUnreadCount: () => {
        return get().emailMessages.filter(m => !m.isRead).length;
    },

    emailFilteredMessages: () => {
        const { emailMessages, emailFilter, emailSearchQuery } = get();
        let filtered = emailMessages;

        // Apply filter
        if (emailFilter === 'unread') {
            filtered = filtered.filter(m => !m.isRead);
        } else if (emailFilter === 'starred') {
            filtered = filtered.filter(m => m.isStarred);
        }

        // Apply search
        if (emailSearchQuery.trim()) {
            const q = emailSearchQuery.toLowerCase();
            filtered = filtered.filter(m =>
                m.subject.toLowerCase().includes(q) ||
                m.from.name.toLowerCase().includes(q) ||
                m.from.email.toLowerCase().includes(q) ||
                m.snippet.toLowerCase().includes(q)
            );
        }

        return filtered;
    },

    // Async actions
    emailConnect: async (provider) => {
        const { emailSetLoading, emailSetError, emailSetAccounts, emailSync } = get();
        emailSetLoading(true);
        emailSetError(null);

        try {
            const { EmailService } = await import('@/services/email/EmailService');
            await EmailService.connectAccount(provider);
            const accounts = await EmailService.getConnectedAccounts();
            emailSetAccounts(accounts);
            // Auto-sync after connecting
            await emailSync(provider);
            logger.info(`[EmailSlice] Connected ${provider}`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            emailSetError(message || `Failed to connect ${provider}`);
            logger.error(`[EmailSlice] Connect ${provider} failed:`, err);
        } finally {
            emailSetLoading(false);
        }
    },

    emailDisconnect: async (provider) => {
        try {
            const { EmailService } = await import('@/services/email/EmailService');
            await EmailService.disconnectAccount(provider);
            const accounts = await EmailService.getConnectedAccounts();
            set({
                emailAccounts: accounts,
                emailMessages: get().emailMessages.filter(m => m.provider !== provider),
            });
            logger.info(`[EmailSlice] Disconnected ${provider}`);
        } catch (err: unknown) {
            logger.error(`[EmailSlice] Disconnect ${provider} failed:`, err);
        }
    },

    emailSync: async (provider?) => {
        const { emailSetSyncing, emailSetMessages, emailAppendMessages, emailAccounts, emailSetError } = get();
        emailSetSyncing(true);
        emailSetError(null);

        try {
            const { EmailService } = await import('@/services/email/EmailService');

            const providersToSync = provider
                ? [provider]
                : emailAccounts.map(a => a.provider);

            const allMessages: EmailMessage[] = [];

            for (const p of providersToSync) {
                const result = await EmailService.fetchMessages(p, { maxResults: 50 });
                allMessages.push(...result.messages);
            }

            // Replace messages for synced providers, keep others
            if (provider) {
                const existing = get().emailMessages.filter(m => m.provider !== provider);
                emailSetMessages([...existing, ...allMessages].sort((a, b) => b.date - a.date));
            } else {
                emailSetMessages(allMessages.sort((a, b) => b.date - a.date));
            }

            logger.info(`[EmailSlice] Synced ${allMessages.length} messages`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            emailSetError(message || 'Sync failed');
            logger.error('[EmailSlice] Sync failed:', err);
        } finally {
            emailSetSyncing(false);
        }
    },

    emailSend: async (data) => {
        const { emailSetError } = get();
        emailSetError(null);

        try {
            const { EmailService } = await import('@/services/email/EmailService');
            const result = await EmailService.sendEmail(data);
            if (!result.success) {
                emailSetError(result.error || 'Send failed');
                return false;
            }
            logger.info('[EmailSlice] Email sent successfully');
            return true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            emailSetError(message || 'Send failed');
            logger.error('[EmailSlice] Send failed:', err);
            return false;
        }
    },
});
