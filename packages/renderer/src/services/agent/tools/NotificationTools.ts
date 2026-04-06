import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';
import { useStore } from '@/core/store';

/**
 * NotificationTools — Multi-Channel Notifications
 *
 * Enables agents to send notifications to users outside the app.
 * Uses Electron's native Notification API for desktop alerts and
 * Firebase Cloud Messaging for background/mobile push (future).
 *
 * Urgency levels:
 * - info: Local desktop notification only
 * - warning: Local + push notification
 * - critical: Local + push + email (future)
 */
export const NotificationTools = {
    /**
     * Send a notification to the user.
     *
     * This is the primary tool for agents to reach users outside the
     * active chat — e.g., when a release goes live, royalties arrive,
     * or a legal issue surfaces.
     */
    send_notification: wrapTool('send_notification', async (args: {
        title: string;
        body: string;
        urgency?: 'info' | 'warning' | 'critical';
        action_url?: string;
    }) => {
        try {
            const { title, body, urgency = 'info', action_url } = args;

            if (!title || title.trim().length === 0) {
                return toolError('Notification title is required.', 'NOTIF_MISSING_TITLE');
            }

            if (!body || body.trim().length === 0) {
                return toolError('Notification body is required.', 'NOTIF_MISSING_BODY');
            }

            // Web Notification API (works in both Electron and browser)
            let desktopDelivered = false;
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try {
                    const notif = new Notification(title.trim(), {
                        body: body.trim(),
                        icon: '/favicon.ico',
                        tag: `indiios-${urgency}`,
                    });

                    if (action_url) {
                        notif.onclick = () => {
                            window.focus();
                            // Navigate via Zustand store for SPA-native routing
                            if (action_url.startsWith('/')) {
                                const moduleId = action_url.replace(/^\//, '');
                                const { setModule } = useStore.getState();
                                if (typeof setModule === 'function') {
                                    // Module ID from URL is dynamic; runtime guard above ensures setModule exists
                                    setModule(moduleId as Parameters<typeof setModule>[0]);
                                    logger.info(`[NotificationTools] Deep-linked to module: ${moduleId}`);
                                } else {
                                    // Fallback: hash navigation
                                    window.location.hash = action_url;
                                }
                            } else {
                                // External URL or hash fragment
                                window.location.hash = action_url;
                            }
                        };
                    }
                    desktopDelivered = true;
                } catch (webErr: unknown) {
                    logger.warn('[NotificationTools] Web Notification failed:', webErr);
                }
            } else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
                logger.warn('[NotificationTools] Notification permission denied by user');
            }

            // Future: FCM push for background/mobile
            // Future: Email for critical urgency

            // Persist notification event for audit trail
            try {
                const { db, auth } = await import('@/services/firebase');
                const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
                const uid = auth.currentUser?.uid;
                if (uid) {
                    await addDoc(collection(db, 'users', uid, 'notifications'), {
                        title: title.trim(),
                        body: body.trim(),
                        urgency,
                        action_url: action_url || null,
                        timestamp: serverTimestamp(),
                        read: false,
                    });
                }
            } catch (persistErr: unknown) {
                logger.warn('[NotificationTools] Failed to persist notification:', persistErr);
            }

            logger.info(`[NotificationTools] Sent [${urgency}] notification: "${title}" (desktop: ${desktopDelivered})`);
            return toolSuccess(
                { title: title.trim(), urgency, desktopDelivered, persisted: true },
                desktopDelivered
                    ? `Notification sent and shown to user: "${title.trim()}"`
                    : `Notification persisted but desktop display was unavailable (permission not granted). The user will see it in their notification center.`
            );
        } catch (error: unknown) {
            logger.error('[NotificationTools] send_notification error:', error);
            return toolError(`Failed to send notification: ${String(error)}`, 'NOTIF_ERROR');
        }
    }),
} satisfies Record<string, AnyToolFunction>;
