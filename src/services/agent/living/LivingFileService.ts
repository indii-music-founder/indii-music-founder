
import { db } from '@/services/firebase';
import { logger } from '@/utils/logger';
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';

export type LivingFileType = 'SOUL' | 'ARTIST' | 'SHOWROOM' | 'PULSE' | 'EPISODIC' | 'RHYTHM';

interface LivingFileDoc {
    content: string;
    updatedAt: Timestamp;
    updatedBy: 'user' | 'agent' | 'system';
    version: number;
}

const DEFAULT_TEMPLATES: Record<LivingFileType, string> = {
    SOUL: `# indii — Your Creative Director

## Identity
- I am indii, the AI creative director for {artistName}
- I speak with confidence and creative vision
- I never mention external tools (Midjourney, DALL-E, ChatGPT)
- I use indiiOS internal engines (GEMINI IMAGE, VEO)

## Voice
- Professional but warm
- Music industry vocabulary
- Proactive, not passive — I suggest, I don't just wait`,

    ARTIST: `# Artist Profile

## Identity
- Genre: [Genre]
- Location: [Location]
- Brand Colors: [Colors]
- Visual Style: [Style]

## Preferences
- [Agent will learn these over time]`,

    SHOWROOM: `# Current Session Context

## Active Project
- Name: [Project Name]
- Stage: [Stage]

## Recent Creations
- [List recent files]`,

    PULSE: `# Studio Pulse Checklist
- Check if new revenue data available
- Check if pending distribution tasks need attention
- Check if any scheduled social posts are due
- Review queued messages from user`,

    EPISODIC: `# Daily Activity Log
`,
    RHYTHM: `# Scheduled Tasks
`
};

/**
 * LivingFileService - Manages the "Living Files" system for persistent agent personality and context.
 * 
 * Each user has a set of markdown-based documents (SOUL, ARTIST, SHOWROOM, etc.) stored in Firestore
 * that define their brand, preferences, and studio state. These are spliced into agent prompts
 * to ensure continuity and custom behavior.
 */
export class LivingFileService {
    private readonly COLLECTION = 'living_files';

    /**
     * Read a living file from the user's collection.
     * If the file does not exist, returns the default template for that file type.
     * 
     * @param userId - ID of the user.
     * @param fileName - The type of living file to read.
     * @returns A promise resolving to the file content string.
     */
    async read(userId: string, fileName: LivingFileType): Promise<string> {
        try {
            const docRef = doc(db, 'users', userId, this.COLLECTION, fileName);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                const data = snapshot.data() as LivingFileDoc;
                return data.content;
            } else {
                // Return default template if not found (and optionally handle initialization elsewhere)
                return DEFAULT_TEMPLATES[fileName];
            }
        } catch (error) {
            logger.error(`[LivingFileService] Failed to read ${fileName}:`, error);
            return DEFAULT_TEMPLATES[fileName]; // Fallback
        }
    }

    /**
     * Write or update a living file in the user's collection.
     * 
     * @param userId - ID of the user.
     * @param fileName - The type of living file to write.
     * @param content - The new content for the file.
     * @param source - The entity making the update (agent, system, or user).
     */
    async write(userId: string, fileName: LivingFileType, content: string, source: 'user' | 'agent' | 'system' = 'agent'): Promise<void> {
        if (!userId) {
            logger.error('[LivingFileService] Cannot write without userId');
            return;
        }

        try {
            const docRef = doc(db, 'users', userId, this.COLLECTION, fileName);

            // We use merge: true to preserve other fields if we add them later, 
            // but for content we generally want to overwrite or append before calling write.
            await setDoc(docRef, {
                content,
                updatedAt: serverTimestamp(),
                updatedBy: source
            }, { merge: true });

            console.debug(`[LivingFileService] Wrote ${fileName} for user ${userId}`);
        } catch (error) {
            logger.error(`[LivingFileService] Failed to write ${fileName}:`, error);
            throw error;
        }
    }

    /**
     * Append an entry to the EPISODIC activity log.
     * Automatically handles daily header creation and timestamping.
     * 
     * @param userId - ID of the user.
     * @param entry - The text entry to append to the log.
     */
    async appendToEpisodic(userId: string, entry: string): Promise<void> {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const currentContent = await this.read(userId, 'EPISODIC');

        const header = `## ${today}`;
        let newContent = currentContent;

        if (currentContent.includes(header)) {
            // Insert after header
            newContent = currentContent.replace(header, `${header}\n- [${new Date().toLocaleTimeString()}] ${entry}`);
        } else {
            // New day, prepend
            newContent = `${header}\n- [${new Date().toLocaleTimeString()}] ${entry}\n\n${currentContent}`;
        }

        await this.write(userId, 'EPISODIC', newContent, 'system');
    }

    /**
     * Append to the SHOWROOM context (e.g. when a new file is created).
     */
    async appendToShowroom(userId: string, entry: string): Promise<void> {
        const currentContent = await this.read(userId, 'SHOWROOM');
        const updatedContent = `${currentContent}\n- ${entry}`;
        await this.write(userId, 'SHOWROOM', updatedContent, 'system');
    }

    /**
     * Inject the full living context for the agent Prompt.
     */
    async injectContext(userId: string): Promise<string> {
        const [soul, artist, showroom] = await Promise.all([
            this.read(userId, 'SOUL'),
            this.read(userId, 'ARTIST'),
            this.read(userId, 'SHOWROOM')
        ]);

        return `
--- LIVING CONTEXT ---
<SOUL>
${soul}
</SOUL>

<ARTIST_PROFILE>
${artist}
</ARTIST_PROFILE>

<PROJECT_CONTEXT>
${showroom}
</PROJECT_CONTEXT>
--- END LIVING CONTEXT ---
        `.trim();
    }
}

export const livingFileService = new LivingFileService();
