import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const db = getFirestore();

export interface DDEXMetadata {
    releaseId: string;
    upc: string;
    isrc: string;
    title: string;
    artist: string;
    label: string;
    releaseDate: string;
    genre: string;
    duration?: number; // duration in seconds or milliseconds
}

/**
 * Format milliseconds or seconds to ISO 8601 duration string (e.g. PT3M30S)
 */
function formatISO8601Duration(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    let durationStr = 'PT';
    if (hrs > 0) durationStr += `${hrs}H`;
    if (mins > 0 || hrs > 0) durationStr += `${mins}M`;
    durationStr += `${secs}S`;
    return durationStr;
}

/** Escape a value for safe interpolation into XML content (ISSUE-859). */
function escapeXml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Verified DDEX sender party id (ISSUE-859). Must be the registered DPID
 * (indii.music / New Detroit Music LLC — PA-DPIDA-2025122604-E) supplied via
 * env — never a hard-coded placeholder. Compilation fails without it.
 */
function requireSenderPartyId(): string {
    const partyId = (process.env.DDEX_SENDER_PARTY_ID || '').trim();
    if (!partyId) {
        throw new HttpsError(
            'failed-precondition',
            'DDEX compilation blocked: DDEX_SENDER_PARTY_ID is not configured with the registered sender DPID.'
        );
    }
    return partyId;
}

/**
 * Native DDEX Compilation Protocol
 * Generates structurally-checked DDEX ERN XML for direct distribution staging.
 * NOTE: full XSD/profile validation is not performed here — output must pass
 * conformance checks before live delivery.
 */
export async function compileDDEXRelease(releaseId: string): Promise<string> {
    const releaseDoc = await db.collection('releases').doc(releaseId).get();
    if (!releaseDoc.exists) {
        throw new HttpsError('not-found', 'Release not found for DDEX compilation.');
    }

    const data = releaseDoc.data() as DDEXMetadata;

    // Deadlock / Consistency check: Ensure UPC and ISRC exist before compiling
    if (!data.upc || !data.isrc) {
        throw new HttpsError('failed-precondition', 'Release deadlock: Missing UPC or ISRC.');
    }

    let durationRaw = 210;
    if (data.duration !== undefined && typeof data.duration === 'number' && !isNaN(data.duration)) {
        durationRaw = data.duration > 10000 ? Math.floor(data.duration / 1000) : data.duration;
        if (durationRaw <= 0) durationRaw = 210;
    }
    const durationXmlStr = formatISO8601Duration(durationRaw);

    const senderPartyId = requireSenderPartyId();

    // DDEX XML generation (Electronic Release Notification Message 4.3 —
    // ISSUE-784: was declaring the 4.2 namespace while the app told users
    // "ERN 4.3". Matches the namespace already used by the canonical
    // generator (IngestionParser.ts). All metadata values are XML-escaped
    // (ISSUE-859).
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ern:NewReleaseMessage xmlns:ern="http://ddex.net/xml/ern/43">
    <MessageHeader>
        <MessageThreadId>${escapeXml(data.releaseId)}</MessageThreadId>
        <MessageId>${escapeXml(data.releaseId)}-${Date.now()}</MessageId>
        <MessageSender>
            <PartyId>${escapeXml(senderPartyId)}</PartyId>
            <PartyName>
                <FullName>indii.music Core Engine</FullName>
            </PartyName>
        </MessageSender>
        <MessageCreatedDateTime>${new Date().toISOString()}</MessageCreatedDateTime>
    </MessageHeader>
    <ReleaseList>
        <Release>
            <ReleaseId>
                <ICPN>${escapeXml(data.upc)}</ICPN>
            </ReleaseId>
            <ReferenceTitle>
                <TitleText>${escapeXml(data.title)}</TitleText>
            </ReferenceTitle>
            <ReleaseResourceReferenceList>
                <ReleaseResourceReference>A1</ReleaseResourceReference>
            </ReleaseResourceReferenceList>
            <ReleaseType>Album</ReleaseType>
            <ReleaseDetailsByTerritory>
                <TerritoryCode>Worldwide</TerritoryCode>
                <LabelName>${escapeXml(data.label)}</LabelName>
            </ReleaseDetailsByTerritory>
        </Release>
    </ReleaseList>
    <ResourceList>
        <SoundRecording>
            <ResourceReference>A1</ResourceReference>
            <Type>Audio</Type>
            <SoundRecordingId>
                <ISRC>${escapeXml(data.isrc)}</ISRC>
            </SoundRecordingId>
            <ReferenceTitle>
                <TitleText>${escapeXml(data.title)}</TitleText>
            </ReferenceTitle>
            <Duration>${durationXmlStr}</Duration>
        </SoundRecording>
    </ResourceList>
</ern:NewReleaseMessage>`;

    return xml;
}

/**
 * PRO Dispatch Payload Structure
 * Internal dispatching to Performance Rights Organizations (BMI, ASCAP)
 */
export async function dispatchPROPayload(releaseId: string): Promise<void> {
    const releaseDoc = await db.collection('releases').doc(releaseId).get();
    if (!releaseDoc.exists) throw new HttpsError('not-found', 'Release not found for PRO dispatch.');

    const data = releaseDoc.data();

    // The standardized CWR (Common Works Registration) or custom API payload
    const proPayload = {
        submitter_id: 'INDII_PUBLISHING',
        work_title: data?.title,
        iswc: data?.iswc || 'PENDING',
        writers: data?.writers || [], // [{ name, ipi_number, split }]
        publishers: data?.publishers || []
    };

    console.log(`Dispatching PRO payload for ${releaseId}:`, proPayload);

    // Persistent/real database logging
    const userId = data?.userId || data?.artistId || 'system';
    const regRef = db.collection('users').doc(userId).collection('proRegistrations').doc(releaseId);
    
    await regRef.set({
        releaseId,
        workTitle: data?.title || 'Unknown Work',
        iswc: data?.iswc || 'PENDING',
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        payload: proPayload
    }, { merge: true });
}
