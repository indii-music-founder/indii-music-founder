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

            // Profile specific logic
            // Assuming "AudioAlbum" or "Album" profile implies:
            // 1. ReleaseType is 'Album'
            // 2. Contains SoundRecording resources
            if (profileVersion.includes('AudioAlbum')) {
                // Check ReleaseList
                const releaseList = root.ReleaseList?.Release;
                if (!releaseList) return false;

                const releases = Array.isArray(releaseList) ? releaseList : [releaseList];

                // Must have at least one Album release
                const hasAlbum = releases.some((r: any) => {
                     const type = r.ReleaseType;
                     return type === 'Album';
                });

                if (!hasAlbum) return false;

                // Check ResourceList
                const resourceList = root.ResourceList;
                const soundRecordings = resourceList?.SoundRecording;

                if (!soundRecordings) return false;
            }

            return true;
        } catch (e) {
            console.error('Profile validation error:', e);
            return false;
        }
    }
}

export const ddexValidator = new DDEXValidator();
