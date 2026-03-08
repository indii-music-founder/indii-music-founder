/**
 * EPKGeneratorService.ts
 * 
 * Generates a dynamic Electronic Press Kit (EPK) based on the user's Artist Identity and Brand Kit.
 * Fulfills PRODUCTION_200 item #147.
 */

import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';

export interface EPKData {
    artistName: string;
    bio: string;
    profileImage: string | null;
    brandColors: string[];
    fonts: string;
    socials: Record<string, string>;
    pressShots: string[];
    latestRelease?: {
        title: string;
        type: string;
        genre: string;
        coverArt?: string;
    };
    contactEmail: string;
}

export class EPKGeneratorService {
    /**
     * Generates the EPK data structure for rendering the public-facing EPK page.
     */
    async generateEPKData(): Promise<EPKData> {
        const store = useStore.getState();
        const profile = store.userProfile;

        if (!profile || profile.id === 'pending') {
            throw new Error('User profile not loaded. Cannot generate EPK.');
        }

        logger.info(`[EPKGenerator] Assembling EPK for ${profile.displayName}...`);

        const brandKit = profile.brandKit;
        const releaseDetails = brandKit?.releaseDetails;

        const epk: EPKData = {
            artistName: profile.displayName || 'Anonymous Artist',
            bio: profile.bio || 'Independent Artist on indiiOS.',
            profileImage: profile.photoURL || '',
            brandColors: brandKit?.colors || ['#000000', '#ffffff'],
            fonts: brandKit?.fonts || 'Inter',
            socials: (brandKit?.socials as Record<string, string> | undefined) || {},
            pressShots: (brandKit?.brandAssets || []).map((a: any) => (typeof a === 'string' ? a : a?.url ?? '')),
            latestRelease: releaseDetails ? {
                title: releaseDetails.title,
                type: releaseDetails.type,
                genre: releaseDetails.genre,
                coverArt: brandKit?.referenceImages?.[0] ? String(brandKit.referenceImages[0]) : undefined
            } : undefined,
            contactEmail: profile.email || ''
        };

        return epk;
    }

    /**
     * Generates the public URL for the artist's EPK.
     */
    getPublicEPKUrl(artistSlug: string): string {
        // Conceptual implementation of indii.os/artist/epk
        const baseUrl = import.meta.env.VITE_EPK_BASE_URL || 'https://indii.os';
        return `${baseUrl}/${this.slugify(artistSlug)}/epk`;
    }

    private slugify(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-');
    }

    /**
     * Formats the EPK data into a JSONLD structure for SEO.
     */
    generateJSONLD(data: EPKData): string {
        return JSON.stringify({
            "@context": "https://schema.org",
            "@type": "MusicGroup",
            "name": data.artistName,
            "description": data.bio,
            "image": data.profileImage,
            "sameAs": Object.values(data.socials)
        });
    }
}

export const epkGeneratorService = new EPKGeneratorService();
