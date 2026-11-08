
 
import { auth, db, functions } from '@/services/firebase';
import { logger } from '@/utils/logger';

export type ServiceStatus = 'healthy' | 'unstable' | 'offline' | 'unknown';

export interface HealthStatus {
    service: string;
    status: ServiceStatus;
    latencyMs?: number;
    lastChecked: number;
    error?: string;
}

class APIHealthService {
    private statuses: Map<string, HealthStatus> = new Map();
    private checkInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Initialize with unknown statuses
        const services = ['firebase_auth', 'firestore', 'functions', 'gemini_api', 'stripe'];
        services.forEach(s => {
            this.statuses.set(s, { service: s, status: 'unknown', lastChecked: Date.now() });
        });
    }

    /**
     * Start periodic health checks
     */
    startMonitoring(intervalMs = 60000) {
        if (this.checkInterval) return;

        // Initial check
        this.checkAll();

        this.checkInterval = setInterval(() => {
            this.checkAll();
        }, intervalMs);

        logger.info(`[APIHealthService] Monitoring started with ${intervalMs}ms interval`);
    }

    /**
     * Force immediate check of all services
     */
    async checkAll(): Promise<Record<string, HealthStatus>> {
        const checks = [
            this.checkFirebaseAuth(),
            this.checkFirestore(),
            this.checkFunctions(),
            this.checkGeminiAPI(),
            this.checkStripe()
        ];

        await Promise.allSettled(checks);
        return this.getAllStatuses();
    }

    private async checkFirebaseAuth() {
        const start = Date.now();
        try {
            // Minimal check: verify we can access auth state
            const _user = auth.currentUser;
            this.updateStatus('firebase_auth', 'healthy', Date.now() - start);
        } catch (e: unknown) {
            this.updateStatus('firebase_auth', 'offline', undefined, String(e));
        }
    }

    private async checkFirestore() {
        const start = Date.now();
        try {
            const { doc, getDoc } = await import('firebase/firestore');
            const probeRef = doc(db, '_health_check', 'probe');
            await Promise.race([
                getDoc(probeRef),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore probe timeout')), 5000))
            ]);
            this.updateStatus('firestore', 'healthy', Date.now() - start);
        } catch (e: unknown) {
            this.updateStatus('firestore', 'offline', undefined, e instanceof Error ? e.message : String(e));
        }
    }

    private async checkFunctions() {
        const start = Date.now();
        try {
            const { httpsCallable } = await import('firebase/functions');
            const pingFn = httpsCallable(functions, 'healthCheck');
            await Promise.race([
                pingFn(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Functions probe timeout')), 5000))
            ]);
            this.updateStatus('functions', 'healthy', Date.now() - start);
        } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e);
            if (errMsg.includes('not-found') || errMsg.includes('unauthenticated')) {
                this.updateStatus('functions', 'healthy', Date.now() - start);
            } else {
                this.updateStatus('functions', 'offline', undefined, errMsg);
            }
        }
    }

    private async checkGeminiAPI() {
        const start = Date.now();
        try {
            const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
            const states = AutonomousIntelligence.getCircuitStates();

            // If any critical circuit is open, status is unstable
            if (Object.values(states).some(s => s === 'open')) {
                this.updateStatus('gemini_api', 'unstable', Date.now() - start, 'Circuit breaker is OPEN');
            } else {
                this.updateStatus('gemini_api', 'healthy', Date.now() - start);
            }
        } catch (e: unknown) {
            this.updateStatus('gemini_api', 'offline', undefined, String(e));
        }
    }

    private async checkStripe() {
        const start = Date.now();
        try {
            const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
            if (!stripeKey) {
                this.updateStatus('stripe', 'unstable', undefined, 'Missing Stripe publishable key');
                return;
            }
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            try {
                const res = await fetch('https://api.stripe.com/healthcheck', {
                    method: 'HEAD',
                    signal: controller.signal,
                }).catch(() => null);
                clearTimeout(timer);
                if (res && (res.ok || res.status === 404 || res.status === 405 || res.status === 401)) {
                    this.updateStatus('stripe', 'healthy', Date.now() - start);
                } else {
                    this.updateStatus('stripe', 'offline', undefined, 'Stripe endpoint unreachable');
                }
            } catch (err: unknown) {
                clearTimeout(timer);
                this.updateStatus('stripe', 'offline', undefined, err instanceof Error ? err.message : String(err));
            }
        } catch (e: unknown) {
            this.updateStatus('stripe', 'offline', undefined, e instanceof Error ? e.message : String(e));
        }
    }

    private updateStatus(service: string, status: ServiceStatus, latency?: number, error?: string) {
        this.statuses.set(service, {
            service,
            status,
            latencyMs: latency,
            lastChecked: Date.now(),
            error
        });
    }

    getAllStatuses(): Record<string, HealthStatus> {
        return Object.fromEntries(this.statuses);
    }

    isSystemHealthy(): boolean {
        return Array.from(this.statuses.values()).every(s => s.status === 'healthy');
    }

    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}

export const apiHealthService = new APIHealthService();
