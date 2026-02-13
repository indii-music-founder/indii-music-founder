
import { db, auth } from '@/services/firebase';
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
- I use indiiOS internal engines (IMAGEN, VEO)

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

export class LivingFileService {
    private readonly COLLECTION = 'living_files';

    /**
     * Read a living file. If it doesn't exist, returns the default template.
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
            console.error(`[LivingFileService] Failed to read ${fileName}:`, error);
            return DEFAULT_TEMPLATES[fileName]; // Fallback
        }
    }

    /**
     * Write/Update a living file.
     */
    async write(userId: string, fileName: LivingFileType, content: string, source: 'user' | 'agent' | 'system' = 'agent'): Promise<void> {
        if (!userId) {
            console.error('[LivingFileService] Cannot write without userId');
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
            console.error(`[LivingFileService] Failed to write ${fileName}:`, error);
            throw error;
        }
    }

    /**
     * Append to the EPISODIC log with a timestamp.
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
