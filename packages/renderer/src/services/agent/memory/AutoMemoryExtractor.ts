import { alwaysOnMemoryEngine } from './AlwaysOnMemoryEngine';
import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface AutoMemoryConfig {
    enabled: boolean;
    extractIntervalMs: number;
    lastExtractedAt?: string;
}

const DEFAULT_CONFIG: AutoMemoryConfig = {
    enabled: true,
    extractIntervalMs: 5 * 60 * 1000, // 5 minutes
};

export class AutoMemoryExtractor {
    private static instance: AutoMemoryExtractor | null = null;
    private extractionTimer: ReturnType<typeof setInterval> | null = null;
    private isRunning = false;
    private userId: string = '';

    private constructor() {}

    public static getInstance(): AutoMemoryExtractor {
        if (!AutoMemoryExtractor.instance) {
            AutoMemoryExtractor.instance = new AutoMemoryExtractor();
        }
        return AutoMemoryExtractor.instance;
    }

    public async start(userId: string): Promise<void> {
        if (this.isRunning) return;
        this.userId = userId;
        this.isRunning = true;

        const config = await this.getConfig();

        if (config.enabled) {
            this.extractionTimer = setInterval(() => {
                this.extractNow().catch(err => {
                    logger.error('[AutoMemoryExtractor] Timer extraction failed:', err);
                });
            }, config.extractIntervalMs);
        }
    }

    public stop(): void {
        if (this.extractionTimer) {
            clearInterval(this.extractionTimer);
            this.extractionTimer = null;
        }
        this.isRunning = false;
    }

    public async getConfig(): Promise<AutoMemoryConfig> {
        if (!this.userId) return DEFAULT_CONFIG;
        try {
            const ref = doc(db, 'users', this.userId, 'settings', 'autoMemory');
            const snap = await getDoc(ref);
            if (snap.exists()) {
                return { ...DEFAULT_CONFIG, ...snap.data() as Partial<AutoMemoryConfig> };
            }
        } catch (error) {
            logger.warn('[AutoMemoryExtractor] Failed to get config:', error);
        }
        return DEFAULT_CONFIG;
    }

    public async updateConfig(updates: Partial<AutoMemoryConfig>): Promise<void> {
        if (!this.userId) return;
        try {
            const current = await this.getConfig();
            const newConfig = { ...current, ...updates };
            const ref = doc(db, 'users', this.userId, 'settings', 'autoMemory');
            await setDoc(ref, newConfig, { merge: true });
            
            // Restart timer if needed
            this.stop();
            if (newConfig.enabled) {
                this.isRunning = true;
                this.extractionTimer = setInterval(() => {
                    this.extractNow().catch(err => {
                        logger.error('[AutoMemoryExtractor] Timer extraction failed:', err);
                    });
                }, newConfig.extractIntervalMs);
            }
        } catch (error) {
            logger.error('[AutoMemoryExtractor] Failed to update config:', error);
        }
    }

    public async extractNow(): Promise<number> {
        if (!this.userId) return 0;
        
        try {
            logger.info('[AutoMemoryExtractor] Starting automated memory extraction');
            
            const state = useStore.getState();
            const activeSessionId = state.activeSessionId;
            if (!activeSessionId) return 0;
            
            const session = state.sessions[activeSessionId];
            if (!session || !session.messages || session.messages.length === 0) {
                 return 0;
            }

            // Get messages since last extraction (simplified: just take last 20)
            const recentMessages = session.messages.slice(-20).map(m => ({
                role: m.role,
                text: typeof m.text === 'string' ? m.text : ''
            })).filter(m => m.text.length > 0);

            if (recentMessages.length === 0) return 0;

            // Ingest to memory engine
            const count = await alwaysOnMemoryEngine.ingestFromSession(recentMessages, session.id);
            
            // Update last extracted at
            await this.updateConfig({ lastExtractedAt: new Date().toISOString() });
            
            return count;
        } catch (error) {
            logger.error('[AutoMemoryExtractor] Extraction failed:', error);
            return 0;
        }
    }
}

export const autoMemoryExtractor = AutoMemoryExtractor.getInstance();
