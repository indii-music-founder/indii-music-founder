/**
 * Items 229-232, 311: Music Industry Portal Agents
 *
 * Pre-configured BrowserAgent tasks for each music industry portal.
 * Each agent defines the goal, start URL, and expected workflow.
 *
 * These agents use the BrowserAgentService core with Gemini Computer Use
 * to automate portal interactions that have no public APIs.
 */

import { browserAgentService, type AgentTask, type PortalCredentials } from './BrowserAgentService';

// ─── Types ──────────────────────────────────────────────────────

export interface WorkRegistration {
    title: string;
    writers: Array<{
        name: string;
        ipi?: string;       // Interested Party Information number
        share: number;       // Ownership percentage (0-100)
        role: 'writer' | 'composer' | 'arranger' | 'lyricist';
    }>;
    publishers: Array<{
        name: string;
        ipi?: string;
        share: number;
    }>;
    iswc?: string;           // International Standard Musical Work Code
    isrc?: string;           // International Standard Recording Code
    genre?: string;
    duration?: number;        // seconds
    releaseDate?: string;
    alternateTitle?: string;
}

export interface RoyaltyStatement {
    period: string;          // e.g., "Q1 2025"
    totalEarnings: number;
    currency: string;
    breakdowns: Array<{
        source: string;      // e.g., "Spotify", "Radio"
        amount: number;
        plays?: number;
    }>;
    pdfUrl?: string;
}

// ─── ASCAP Agent (Item 229) ─────────────────────────────────────

export class ASCAPAgent {
    private credentials: PortalCredentials | undefined;

    constructor(credentials?: PortalCredentials) {
        this.credentials = credentials ? { ...credentials, portal: 'ASCAP' } : undefined;
    }

    /**
     * Register a new musical work with ASCAP.
     * Navigates: Login → Member Access → Works Management → Register New Work
     */
    async registerWork(work: WorkRegistration): Promise<AgentTask> {
        const goal = `Register a new musical work with ASCAP Member Access:
            - Title: "${work.title}"
            - Writers: ${work.writers.map(w => `${w.name} (${w.role}, ${w.share}%)`).join(', ')}
            - Publishers: ${work.publishers.map(p => `${p.name} (${p.share}%)`).join(', ')}
            ${work.iswc ? `- ISWC: ${work.iswc}` : ''}
            ${work.isrc ? `- ISRC: ${work.isrc}` : ''}
            ${work.genre ? `- Genre: ${work.genre}` : ''}
            
            Steps:
            1. Log in to ASCAP Member Access
            2. Navigate to "Register a Work" or "Works Registration"
            3. Fill in the title, writers, publishers, and shares
            4. Submit the registration
            5. Note the confirmation number or work ID`;

        return browserAgentService.executeTask(
            'ASCAP',
            goal,
            'https://www.ascap.com/member-access',
            this.credentials
        );
    }

    /**
     * Check royalty statements from ASCAP.
     */
    async checkRoyalties(period?: string): Promise<AgentTask> {
        const goal = `Check ASCAP royalty statements:
            ${period ? `- Period: ${period}` : '- Most recent available period'}
            
            Steps:
            1. Log in to ASCAP Member Access
            2. Navigate to "Royalty Statements" or "Payments"
            3. Find the ${period || 'most recent'} statement
            4. Extract: total earnings, per-source breakdown, payment date
            5. Report the data in structured format`;

        return browserAgentService.executeTask(
            'ASCAP',
            goal,
            'https://www.ascap.com/member-access',
            this.credentials
        );
    }
}

// ─── BMI Agent (Item 230) ───────────────────────────────────────

export class BMIAgent {
    private credentials: PortalCredentials | undefined;

    constructor(credentials?: PortalCredentials) {
        this.credentials = credentials ? { ...credentials, portal: 'BMI' } : undefined;
    }

    /**
     * Register a new song with BMI.
     * Navigates: Login → BMI Online → Song Registration
     */
    async registerSong(work: WorkRegistration): Promise<AgentTask> {
        const goal = `Register a new song with BMI Online Services:
            - Title: "${work.title}"
            - Writers: ${work.writers.map(w => `${w.name} (${w.role}, ${w.share}%)`).join(', ')}
            - Publishers: ${work.publishers.map(p => `${p.name} (${p.share}%)`).join(', ')}
            ${work.iswc ? `- ISWC: ${work.iswc}` : ''}
            
            Steps:
            1. Log in to BMI Online Services
            2. Navigate to "Register Works" or "Song Registration"
            3. Fill in title, alternate titles, writers with roles and splits
            4. Add publisher information with shares
            5. Submit and note the BMI Work ID`;

        return browserAgentService.executeTask(
            'BMI',
            goal,
            'https://www.bmi.com/login',
            this.credentials
        );
    }

    /**
     * Check BMI royalty statements.
     */
    async checkRoyalties(period?: string): Promise<AgentTask> {
        const goal = `Check BMI royalty statements for ${period || 'the most recent period'}:
            
            Steps:
            1. Log in to BMI Online Services
            2. Navigate to "Royalties" or "Payment History"
            3. Locate the ${period || 'latest'} statement
            4. Extract: total amount, per-work breakdown, performance data
            5. Report in structured format`;

        return browserAgentService.executeTask(
            'BMI',
            goal,
            'https://www.bmi.com/login',
            this.credentials
        );
    }
}

// ─── SoundExchange Agent (Item 231) ─────────────────────────────

export class SoundExchangeAgent {
    private credentials: PortalCredentials | undefined;

    constructor(credentials?: PortalCredentials) {
        this.credentials = credentials ? { ...credentials, portal: 'SoundExchange' } : undefined;
    }

    /**
     * Enroll a new recording with SoundExchange.
     */
    async enrollRecording(
        title: string,
        artist: string,
        isrc: string,
        releaseDate?: string
    ): Promise<AgentTask> {
        const goal = `Enroll a recording with SoundExchange:
            - Title: "${title}"
            - Artist: "${artist}"
            - ISRC: ${isrc}
            ${releaseDate ? `- Release Date: ${releaseDate}` : ''}
            
            Steps:
            1. Log in to SoundExchange portal
            2. Navigate to "Register Sound Recordings" or "Add Recordings"
            3. Enter the track title, performing artist, and ISRC
            4. Verify the recording details
            5. Submit and note confirmation`;

        return browserAgentService.executeTask(
            'SoundExchange',
            goal,
            'https://www.soundexchange.com/artist-user-login/',
            this.credentials
        );
    }
}

// ─── Harry Fox Agency Agent (Item 232) ──────────────────────────

export class HarryFoxAgent {
    private credentials: PortalCredentials | undefined;

    constructor(credentials?: PortalCredentials) {
        this.credentials = credentials ? { ...credentials, portal: 'HarryFox' } : undefined;
    }

    /**
     * Search for and request a mechanical license via Songfile.
     */
    async requestMechanicalLicense(
        songTitle: string,
        originalArtist: string,
        intendedUse: 'cover' | 'sample' | 'interpolation',
        units: number
    ): Promise<AgentTask> {
        const goal = `Request a mechanical license via Harry Fox Agency / Songfile:
            - Song: "${songTitle}" by ${originalArtist}
            - Use Type: ${intendedUse}
            - Planned Units: ${units}
            
            Steps:
            1. Go to Songfile (songfile.com)
            2. Search for "${songTitle}" by "${originalArtist}"
            3. Select the correct song/work
            4. Choose "${intendedUse}" as the license type
            5. Enter planned distribution quantity: ${units}
            6. Review the license terms and fee
            7. PAUSE before final submission (requires user confirmation for payment)`;

        return browserAgentService.executeTask(
            'HarryFox/Songfile',
            goal,
            'https://www.harryfox.com/songfile',
            this.credentials
        );
    }
}

// ─── Mechanical Royalty Agent (Item 311) ─────────────────────────

export class MechanicalRoyaltyAgent {
    private credentials: PortalCredentials | undefined;

    constructor(credentials?: PortalCredentials) {
        this.credentials = credentials ? { ...credentials, portal: 'MusicReports' } : undefined;
    }

    /**
     * Pull mechanical royalty statements from Music Reports / HFA.
     */
    async pullStatements(period?: string): Promise<AgentTask> {
        const goal = `Pull mechanical royalty statements:
            ${period ? `- Period: ${period}` : '- Most recent available period'}
            
            Steps:
            1. Log in to the royalty portal
            2. Navigate to "Statements" or "Royalty Reports"
            3. Download or extract the ${period || 'latest'} statement
            4. Parse: total mechanical royalties, per-song breakdown, streaming vs physical
            5. Report in structured format`;

        return browserAgentService.executeTask(
            'MusicReports',
            goal,
            'https://www.musicreports.com/',
            this.credentials
        );
    }
}

// ─── Factory ────────────────────────────────────────────────────

export function createPortalAgent(
    portal: 'ascap' | 'bmi' | 'soundexchange' | 'harryfox' | 'musicreports',
    credentials?: PortalCredentials
) {
    switch (portal) {
        case 'ascap':
            return new ASCAPAgent(credentials);
        case 'bmi':
            return new BMIAgent(credentials);
        case 'soundexchange':
            return new SoundExchangeAgent(credentials);
        case 'harryfox':
            return new HarryFoxAgent(credentials);
        case 'musicreports':
            return new MechanicalRoyaltyAgent(credentials);
    }
}
