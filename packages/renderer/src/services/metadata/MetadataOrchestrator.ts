import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
import { IdentifierService } from '@/services/identity/IdentifierService';
import { trackLibrary } from './TrackLibraryService';
import { ExtendedGoldenMetadata, INITIAL_METADATA } from './types';
import { Logger } from '@/core/logger/Logger';

/**
 * MetadataOrchestrator
 * The "Grand Central Station" for music metadata.
 * Coordinates between Intelligence analysis, industry identifiers, and persistence.
 */
export class MetadataOrchestrator {
    /**
     * Compute whether metadata meets golden (distribution-ready) requirements.
     * Golden status requires: at least one split, non-default publisher, valid identifiers.
     */
    static computeGoldenStatus(metadata: Partial<ExtendedGoldenMetadata>): boolean {
        // Must have at least one royalty split
        if (!metadata.splits || metadata.splits.length === 0) {
            return false;
        }

        // All splits must have valid data (legalName, email, valid percentage)
        const allSplitsValid = metadata.splits.every(split =>
            split.legalName?.trim() &&
            split.email?.trim() &&
            typeof split.percentage === 'number' &&
            split.percentage > 0 &&
            split.percentage <= 100
        );
        if (!allSplitsValid) {
            return false;
        }

        // Publisher must not be default/empty
        if (!metadata.publisher || metadata.publisher === 'Self-Published' || !metadata.publisher.trim()) {
            return false;
        }

        // Label name must not be empty (required for golden)
        if (!metadata.labelName || !metadata.labelName.trim()) {
            return false;
        }

        // Must have valid ISRC format
        if (!metadata.isrc || !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(metadata.isrc)) {
            return false;
        }

        // Must have basic metadata
        if (!metadata.trackTitle || !metadata.artistName || !metadata.genre) {
            return false;
        }

        return true;
    }
    /**
     * Creates a high-fidelity Golden Metadata record from a raw audio file.
     */
    async createGoldenMetadata(file: File, initialData: Partial<ExtendedGoldenMetadata> = {}): Promise<ExtendedGoldenMetadata> {
        Logger.info('MetadataOrchestrator', `Creating golden metadata for ${file.name}`);

        // 1. Run Autonomous Intelligence (Technical + Semantic)
        const profile = await audioIntelligence.analyze(file);
        const artistName = initialData.artistName?.trim();
        if (!artistName) {
            throw new Error('Artist name is required to create golden metadata.');
        }
        
        // 2. Auto-generate Industry Identifiers if missing
        const isrc = initialData.isrc || await IdentifierService.nextISRC();
        // ISSUE-783: every commercial release requires a release-level UPC/ICPN for
        // DDEX packaging (AuthorityPanel/DDEX validation), including singles.
        const upc = initialData.upc || await IdentifierService.nextUPC();

        // 3. Map Intelligence results to Golden Metadata Schema
        const metadata: ExtendedGoldenMetadata = {
            ...INITIAL_METADATA,
            ...initialData,
            id: profile.id,
            masterFingerprint: profile.id,
            trackTitle: initialData.trackTitle || file.name.replace(/\.[^/.]+$/, ""), // Strip extension
            artistName,
            isrc,
            upc,
            genre: profile.semantic.ddexGenre,
            subGenre: profile.semantic.ddexSubGenre,
            mood: profile.semantic.mood,
            keywords: profile.semantic.marketingHooks.keywords,
            language: profile.semantic.language,
            isInstrumental: profile.semantic.language === 'zxx',
            explicit: profile.semantic.isExplicit,
            bpm: profile.technical.bpm,
            key: profile.technical.key,
            energy: profile.technical.energy,
            durationSeconds: profile.technical.duration,
            durationFormatted: this.formatDuration(profile.technical.duration),
            releaseDate: initialData.releaseDate || new Date().toISOString().split('T')[0]!,
            releaseType: initialData.releaseType || 'Single',
            isGolden: true, // Mark as Golden since it's Intelligence-verified and ID-assigned
            aiGeneratedContent: initialData.aiGeneratedContent || {
                isFullyAIGenerated: false,
                isPartiallyAIGenerated: false,
                aiToolsUsed: [],
                humanContribution: 'Original recording provided by user.'
            }
        };

        // 4. Save to Track Library (Firestore)
        await trackLibrary.saveTrack(metadata);
        
        // 5. PROACTIVE: Trigger Digital Handshake for collaborators
        if (metadata.splits && metadata.splits.length > 0) {
            this.triggerCollaboratorHandshake(metadata);
        }
        
        Logger.info('MetadataOrchestrator', `Golden Metadata created: ${metadata.trackTitle} (${metadata.isrc})`);
        return metadata;
    }

    /**
     * Proactively suggests legal protection when new collaborators are detected.
     */
    private async triggerCollaboratorHandshake(metadata: ExtendedGoldenMetadata) {
        const { useStore } = await import('@/core/store');
        const { addAgentMessage } = useStore.getState();

        const externalCollaborators = metadata.splits.filter(s => 
            s.legalName.toLowerCase() !== 'self' && 
            s.legalName.toLowerCase() !== metadata.artistName.toLowerCase()
        );

        if (externalCollaborators.length > 0) {
            const collaboratorNames = externalCollaborators.map(c => c.legalName).join(', ');
            
            // Inject a proactive message from the Legal Agent into the chat
            addAgentMessage({
                id: crypto.randomUUID(),
                role: 'model',
                text: `I've detected new collaborators on "${metadata.trackTitle}": **${collaboratorNames}**. \n\nTo ensure your rights are protected, would you like me to generate a **Genesis Split Sheet** for everyone to sign digitally?`,
                timestamp: Date.now(),
                agentId: 'legal'
            });
        }
    }

    private formatDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

export const metadataOrchestrator = new MetadataOrchestrator();
