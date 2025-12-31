
import { DPID } from '../ddex/types/common';

/**
 * DeliveryProfile
 *
 * Configures how we talk to a specific partner.
 * Handles "Test Mode" (Step 4 Peer Conformance) vs "Live Mode".
 */

export interface DeliveryProfile {
    id: string;
    partnerName: string;
    dpid: DPID;

    // Conformance / Test Settings
    isTestMode: boolean; // If true, sets MessageControlType='TestMessage'

    // Technical Settings
    deliveryMethod: 'SFTP_Batch' | 'SFTP_Single' | 'S3';
    ernVersion: '4.3' | '3.8.2';
}

export const SPOTIFY_PROFILE: DeliveryProfile = {
    id: 'spotify',
    partnerName: 'Spotify',
    dpid: 'PADPIDA201202202', // Example Spotify DPID
    isTestMode: true, // Defaulting to Test Mode for Peer Conformance
    deliveryMethod: 'SFTP_Batch',
    ernVersion: '4.3'
};

export const APPLE_PROFILE: DeliveryProfile = {
    id: 'apple',
    partnerName: 'Apple Music',
    dpid: 'PADPIDA201202203',
    isTestMode: true,
    deliveryMethod: 'SFTP_Single', // Apple often uses Transporter (pkg)
    ernVersion: '4.3'
};
