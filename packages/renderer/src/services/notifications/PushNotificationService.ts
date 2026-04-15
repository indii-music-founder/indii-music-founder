import { getToken, onMessage, type Messaging, type MessagePayload } from 'firebase/messaging';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { app, db, getFirebaseMessaging } from '@/services/firebase';
import { logger } from '@/utils/logger';

/**
 * Requirement 161: Native Push Notifications (APNs/FCM)
 * Full deep-linking push infrastructure for the companion Mobile app and PWA.
 */

export class PushNotificationService {
    private messaging: Messaging | null = null;
    private vapidKey = import.meta.env.VITE_FCM_VAPID_KEY;
    private initPromise: Promise<void> | null = null;

    /**
     * Lazy-init messaging to avoid synchronous getMessaging() on unsupported browsers.
     */
    private async ensureMessaging(): Promise<Messaging | null> {
        if (this.messaging) return this.messaging;
        if (!this.initPromise) {
            this.initPromise = getFirebaseMessaging().then((m) => {
                this.messaging = m;
            });
        }
        await this.initPromise;
        return this.messaging;
    }

    /**
     * Requests user permission for notifications and retrieves the FCM registration token.
     * Saves the token to the user's Firestore profile to enable targeted backend push.
     */
    public async requestPermissionAndGetToken(): Promise<string | null> {
        const messaging = await this.ensureMessaging();
        if (!messaging) return null;

        try {
            const permission = await Notification.requestPermission();

            if (permission === 'granted') {
                const token = await getToken(messaging, { vapidKey: this.vapidKey });

                if (token) {
                    logger.info('[PushNotificationService] Retrieved FCM token successfully.');
                    await this.saveTokenToDatabase(token);
                    return token;
                } else {
                    logger.warn('[PushNotificationService] No registration token available.');
                    return null;
                }
            } else {
                logger.warn('[PushNotificationService] Notification permission denied.');
                return null;
            }
        } catch (error: unknown) {
            logger.error('[PushNotificationService] Failed to get FCM token:', error);
            return null;
        }
    }

    /**
     * Listens for foreground messages when the app is active.
     */
    public onForegroundMessage(callback: (payload: MessagePayload) => void): () => void {
        // Kick off async init; if not ready yet, return no-op
        const messaging = this.messaging;
        if (!messaging) {
            // Try to init lazily and set up listener once ready
            this.ensureMessaging().then((m) => {
                if (m) onMessage(m, callback);
            });
            return () => { };
        }

        return onMessage(messaging, (payload) => {
            logger.info('[PushNotificationService] Received foreground message:', payload);

            // Optionally, we can manually trigger a local browser notification here
            // if we want to show it even when the app is in the foreground
            if (payload.notification) {
                new Notification(payload.notification.title || 'indiiOS Notification', {
                    body: payload.notification.body,
                    icon: '/pwa-192x192.png'
                });
            }

            callback(payload);
        });
    }

    /**
     * Saves the FCM token to Firestore so the backend can send targeted push notifications.
     */
    private async saveTokenToDatabase(token: string): Promise<void> {
        const auth = getAuth(app);
        const user = auth.currentUser;

        if (!user) {
            logger.debug('[PushNotificationService] User not authenticated, skipping token save.');
            return;
        }

        try {
            await setDoc(doc(db, 'users', user.uid, 'fcm_tokens', token), {
                token,
                platform: this.detectPlatform(),
                updatedAt: new Date().toISOString()
            }, { merge: true });
            logger.debug('[PushNotificationService] Saved FCM token to Firestore.');
        } catch (error: unknown) {
            logger.error('[PushNotificationService] Failed to save FCM token to Firestore:', error);
        }
    }

    private detectPlatform(): string {
        const userAgent = navigator.userAgent || navigator.vendor || (window.opera as string) || '';
        if (/android/i.test(userAgent)) return 'Android';
        if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) return 'iOS';
        return 'Web';
    }
}

export const pushNotificationService = new PushNotificationService();