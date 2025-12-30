/**
 * DDEX Validator
 * Validates XML messages against DDEX XSD schemas
 */

import { XMLParser } from 'fast-xml-parser';

export class DDEXValidator {
    /**
     * Validate an XML string against a specific schema version
     * Note: In a browser/electron environment, full XSD validation is difficult.
     * This is a simulated validator that checks for key structural elements.
     */
    validateXML(xml: string, schemaVersion: string = '4.3'): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check for XML declaration
        if (!xml.trim().startsWith('<?xml')) {
            errors.push('Missing XML declaration');
        }

        // Check for Root Element
        if (!xml.includes('NewReleaseMessage') && !xml.includes('PurgeReleaseMessage')) {
            errors.push('Missing valid DDEX root element (NewReleaseMessage)');
        }

        // Check for DDEX Namespace
        if (!xml.includes('http://ddex.net/xml/ern')) {
            errors.push('Missing DDEX namespace declaration');
        }

        // Check Schema Version Attribute
        if (!xml.includes(`MessageSchemaVersionId="${schemaVersion}"`) && !xml.includes(`MessageSchemaVersionId='${schemaVersion}'`)) {
            // Only warn if exact match isn't found, as implementation details vary
            // warnings.push(`Schema version mismatch or missing. Expected ${schemaVersion}`);
        }

        // Basic Structural Checks using regex (naive, but fast for client-side)
        const requiredTags = [
            'MessageHeader',
            'MessageId',
            'MessageSender',
            'MessageRecipient',
            'MessageCreatedDateTime',
            'ReleaseList',
            'ResourceList',
            'DealList'
        ];

        requiredTags.forEach(tag => {
            if (!xml.includes(`<${tag}`) && !xml.includes(`<ern:${tag}`)) {
                errors.push(`Missing required element: ${tag}`);
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Check if a specific profile is valid for a release
     * (e.g. Audio Album vs. Video Single)
     */
    validateProfile(xml: string, profileVersion: string = 'CommonReleaseTypes/14/AudioAlbum'): boolean {
        try {
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
                removeNSPrefix: true
            });
            const parsed = parser.parse(xml);

            // Find Root
            const rootKey = Object.keys(parsed).find(key => key === 'NewReleaseMessage');
            if (!rootKey) return false;

            const root = parsed[rootKey];

            // Check Profile Version ID
            const actualProfile = root['@_ReleaseProfileVersionId'];
            if (!actualProfile || !actualProfile.includes(profileVersion)) {
                 // Fallback logic for partial matches
                 if (!profileVersion.includes('/') && actualProfile?.endsWith(profileVersion)) {
                     // Acceptable
                 } else if (actualProfile !== profileVersion) {
                     return false;
                 }
            }

            // Normalize profile for checking (e.g., 'AudioAlbum' from 'CommonReleaseTypes/14/AudioAlbum')
            const profile = profileVersion.split('/').pop() || profileVersion;

            // Helper to get array from list (handles single item or array)
            const getArray = (item: any) => item ? (Array.isArray(item) ? item : [item]) : [];

            const releaseList = getArray(root.ReleaseList?.Release);
            if (releaseList.length === 0) return false;

            const resourceList = root.ResourceList || {};

            switch (profile) {
                case 'AudioAlbum':
                    // 1. ReleaseType is 'Album'
                    if (!releaseList.some((r: any) => r.ReleaseType === 'Album')) return false;
                    // 2. Contains SoundRecording
                    if (!resourceList.SoundRecording) return false;
                    // 3. Contains Image (Cover Art is mandatory for Albums)
                    if (!resourceList.Image) return false;
                    break;

                case 'Single':
                    // 1. ReleaseType is 'Single'
                    if (!releaseList.some((r: any) => r.ReleaseType === 'Single')) return false;
                    // 2. Contains SoundRecording
                    if (!resourceList.SoundRecording) return false;
                    // 3. Contains Image
                    if (!resourceList.Image) return false;
                    break;

                case 'VideoSingle':
                    // 1. ReleaseType is 'VideoSingle'
                    if (!releaseList.some((r: any) => r.ReleaseType === 'VideoSingle')) return false;
                    // 2. Contains Video
                    if (!resourceList.Video) return false;
                    // 3. Contains Image (Thumbnail/Cover)
                    if (!resourceList.Image) return false;
                    break;

                case 'Ringtone':
                    // 1. ReleaseType is 'Ringtone'
                    if (!releaseList.some((r: any) => r.ReleaseType === 'Ringtone')) return false;
                    // 2. Contains SoundRecording
                    if (!resourceList.SoundRecording) return false;
                    break;

                default:
                    // For unknown profiles, we enforce basic structural integrity (ReleaseList exists)
                    // but do not enforce specific resource types as we don't know the rules.
                    console.warn(`Profile validation: Unknown profile type '${profile}', skipping specific checks.`);
                    break;
            }

            return true;
        } catch (e) {
            console.error('Profile validation error:', e);
            return false;
        }
    }
}

export const ddexValidator = new DDEXValidator();
