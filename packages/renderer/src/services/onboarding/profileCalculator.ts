import type { UserProfile, BrandKit, ReleaseDetails, SocialLinks } from './types';
import type { OnboardingPhase } from './types';

/**
 * Calculates the completeness status of an artist's profile.
 * Checks two layers: Core Identity (permanent) and Release Context (transient).
 */
export function calculateProfileStatus(profile: UserProfile) {
    // Safe access to nested properties
    // Use Partial<BrandKit> to correctly type the fallback empty object and allow safe access to optional properties
    const brandKit: Partial<BrandKit> = profile.brandKit || {};
    const releaseDetails: Partial<ReleaseDetails> = brandKit.releaseDetails || {};
    const socials: Partial<SocialLinks> = brandKit.socials || {};
    const brandAssets = brandKit.brandAssets || [];
    const colors = brandKit.colors || [];

    // Level 1: Artist Identity (Permanent)
    const coreChecks = {
        bio: !!profile.bio && profile.bio.length > 10,
        brandDescription: !!brandKit.brandDescription,
        socials: !!(socials.twitter || socials.instagram || socials.website),
        // Visuals: complete if they have assets OR explicitly acknowledged they have none
        visuals: (brandAssets.length > 0 || colors.length > 0 || brandKit.visualsAcknowledged === true),
        careerStage: !!profile.careerStage,
        goals: !!(profile.goals && profile.goals.length > 0),
        // New branding fields
        colorPalette: !!(colors.length > 0),
        typography: !!brandKit.fonts,
        aestheticStyle: !!brandKit.aestheticStyle,
        distributor: !!socials.distributor,
    };

    // Level 2: Release Context (Transient)
    const releaseChecks = {
        title: !!releaseDetails.title,
        type: !!releaseDetails.type,
        genre: !!releaseDetails.genre,
        mood: !!releaseDetails.mood,
        themes: !!releaseDetails.themes,
    };

    const coreMissing = Object.keys(coreChecks).filter(key => !coreChecks[key as keyof typeof coreChecks]);
    const releaseMissing = Object.keys(releaseChecks).filter(key => !releaseChecks[key as keyof typeof releaseChecks]);

    const coreProgress = Math.round((Object.values(coreChecks).filter(Boolean).length / Object.keys(coreChecks).length) * 100);
    const releaseProgress = Math.round((Object.values(releaseChecks).filter(Boolean).length / Object.keys(releaseChecks).length) * 100);

    return { coreChecks, releaseChecks, coreMissing, releaseMissing, coreProgress, releaseProgress };
}

/**
 * Determines the current onboarding phase based on profile completeness.
 */
export function determinePhase(profile: UserProfile): OnboardingPhase {
    const { coreMissing, coreProgress, releaseProgress } = calculateProfileStatus(profile);

    // No bio = just starting
    if (!profile.bio || profile.bio.length < 10) return 'identity_intro';

    // Core identity incomplete
    if (coreMissing.includes('careerStage') || coreMissing.includes('goals') || coreMissing.includes('distributor')) return 'identity_core';

    // Branding incomplete (colors, fonts, aesthetic)
    const brandKit: Partial<BrandKit> = profile.brandKit || {};
    if (!brandKit.colors?.length && !brandKit.fonts && !brandKit.brandDescription) return 'identity_branding';

    // Visuals incomplete
    if (coreMissing.includes('visuals')) return 'identity_visuals';

    // All identity done, check release
    if (coreProgress >= 100 && releaseProgress === 0) return 'release_intro';

    // Release in progress
    const { releaseMissing } = calculateProfileStatus(profile);
    if (releaseMissing.length > 0) return 'release_details';

    // Everything complete
    return 'complete';
}
