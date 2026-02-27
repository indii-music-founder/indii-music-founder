import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
import { IdentifierService } from '@/services/identity/IdentifierService';
import { trackLibrary } from './TrackLibraryService';
import { ExtendedGoldenMetadata, INITIAL_METADATA } from './types';
import { Logger } from '@/core/logger/Logger';

/**
 * MetadataOrchestrator
 * The "Grand Central Station" for music metadata.
 * Coordinates between AI analysis, industry identifiers, and persistence.
 */
export class MetadataOrchestrator {
    /**
     * Creates a high-fidelity Golden Metadata record from a raw audio file.
     */
    async createGoldenMetadata(file: File, initialData: Partial<ExtendedGoldenMetadata> = {}): Promise<ExtendedGoldenMetadata> {
        Logger.info('MetadataOrchestrator', `Creating golden metadata for ${file.name}`);

        // 1. Run AI Intelligence (Technical + Semantic)
        const profile = await audioIntelligence.analyze(file);
        
        // 2. Auto-generate Industry Identifiers if missing
        const isrc = initialData.isrc || await IdentifierService.nextISRC();
        const upc = initialData.upc || (initialData.releaseType !== 'Single' ? await IdentifierService.nextUPC() : undefined);

        // 3. Map AI results to Golden Metadata Schema
        const metadata: ExtendedGoldenMetadata = {
            ...INITIAL_METADATA,
            ...initialData,
            id: profile.id,
            masterFingerprint: profile.id,
            trackTitle: initialData.trackTitle || file.name.replace(/\.[^/.]+$/, ""), // Strip extension
            artistName: initialData.artistName || 'Unknown Artist',
            isrc,
            upc,
            genre: profile.semantic.ddexGenre,
            subGenre: profile.semantic.ddexSubGenre,
            mood: profile.semantic.mood,
            keywords: profile.semantic.marketingHooks.keywords,
            language: profile.semantic.language,
            isInstrumental: profile.semantic.language === 'zxx',
            explicit: profile.semantic.isExplicit,
            durationSeconds: profile.technical.duration,
            durationFormatted: this.formatDuration(profile.technical.duration),
            releaseDate: initialData.releaseDate || new Date().toISOString().split('T')[0],
            releaseType: initialData.releaseType || 'Single',
            isGolden: true, // Mark as Golden since it's AI-verified and ID-assigned
            aiGeneratedContent: {
                isFullyAIGenerated: false, // Default to false unless specified
                isPartiallyAIGenerated: true,
                aiToolsUsed: [profile.modelVersion],
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
