/**
 * RightsRegistrationWalkthroughModal.tsx
 *
 * Interactive Copilot & Walkthrough Guide for Official Music Rights Infrastructure:
 * Guides artists step-by-step through verifying and acquiring organization-level legal credentials
 * (U.S. Copyright Office / Library of Congress eCO, The MLC, PRO Writer & Publisher Affiliation
 * [BMI / ASCAP / SESAC], SoundExchange, US ISRC Agency, GS1 US UPCs, and DDEX DPID).
 *
 * Follows Sovereign Luxury & Analog Craft design aesthetic (Obsidian #14100C,
 * Champagne Gold #FFD700/#FFB800, and Molten Ingot gradients).
 */

import React, { useState, useEffect, useId } from 'react';
import { reportPrerequisite, type PrerequisiteReports } from '../prerequisiteReports';
import { motion } from 'motion/react';
import {
    X,
    ExternalLink,
    CheckCircle2,
    Circle,
    Copy,
    Check,
    Compass,
    Sparkles,
    AlertTriangle,
    ShieldCheck,
    ArrowRight,
    Save,
    Building2,
    Scale,
    FileCheck2,
    DollarSign,
    Radio,
    Barcode,
    Share2
} from 'lucide-react';
import type { FounderPrerequisiteId } from '../types';

export interface RightsWalkthroughGuide {
    id: FounderPrerequisiteId;
    title: string;
    organization: string;
    tagline: string;
    category: 'copyright' | 'royalties' | 'identity' | 'distribution';
    difficulty: 'Instant' | 'Easy (5 min)' | 'Moderate (10 min)' | 'Agency Application';
    feeDescription: string;
    accentColor: string;
    badgeBg: string;
    borderColor: string;
    icon: React.ReactNode;
    whyItMatters: string[];
    prerequisites: string[];
    steps: {
        stepNumber: number;
        title: string;
        instruction: string;
        portalUrl?: string;
        portalLabel?: string;
        copyValue?: string;
        copyLabel?: string;
        tip?: string;
    }[];
    identifierLabel: string;
    identifierPlaceholder: string;
    identifierHelp: string;
    troubleshooting: string;
    officialUrl: string;
}

export const RIGHTS_GUIDES: Record<FounderPrerequisiteId, RightsWalkthroughGuide> = {
    usco_org: {
        id: 'usco_org',
        title: 'U.S. Copyright Office eCO Registration',
        organization: 'Library of Congress',
        tagline: 'Official federal copyright registration establishing prima facie proof of legal ownership and statutory damages protection.',
        category: 'copyright',
        difficulty: 'Moderate (10 min)',
        feeDescription: '$45 Single Author / $65 Standard filing',
        accentColor: 'text-[#FFD700]',
        badgeBg: 'bg-[#FFD700]/10',
        borderColor: 'border-[#FFD700]/30',
        icon: <Scale className="w-5 h-5 text-[#FFD700]" />,
        whyItMatters: [
            'Establishes prima facie legal presumption of ownership in US federal courts under Title 17',
            'Mandatory prerequisite before filing any federal copyright infringement lawsuit',
            'Unlocks statutory damages up to $150,000 per willful infringement plus attorney fees',
            'Permanent legal preservation in the historic Library of Congress national catalogue'
        ],
        prerequisites: [
            'Legal author name(s) and claimant business organization name',
            'Lossless audio master file (.WAV / .FLAC) or sheet music/lyrics deposit copy',
            'Knowledge of Work Type: Sound Recording (SR) vs Performing Arts Musical Work (PA)'
        ],
        steps: [
            {
                stepNumber: 1,
                title: 'Establish eCO Electronic Organization Account',
                instruction: 'Open the official Library of Congress electronic Copyright Office (eCO) portal and create an account using your legal name or artist company profile.',
                portalUrl: 'https://eco.copyright.gov/eService_enu/',
                portalLabel: 'Open eCO Portal',
                tip: 'Avoid third-party copyright registration filing mills that mark up government fees by $100+.'
            },
            {
                stepNumber: 2,
                title: 'Select Application Type (PA vs SR or Combined)',
                instruction: 'Choose "Standard Application". Select "Work of the Performing Arts" (Form PA) for the underlying composition & lyrics, or "Sound Recording" (Form SR) for the recorded master.',
                portalUrl: 'https://www.copyright.gov/register/pa-sr.html',
                portalLabel: 'Review PA vs SR Rules',
                tip: 'If you are the sole author of both the music and the recording, you can file Form SR to claim both in one single fee.'
            },
            {
                stepNumber: 3,
                title: 'Upload Audio Deposit & Submit Fee',
                instruction: 'Complete the author and claimant sections. Upload your full-length lossless audio deposit and submit the statutory fee ($45-$65). Note down your Service Request (SR) or Case Number.',
                tip: 'Your Case Number serves as official legal filing proof while certificate processing takes place.'
            }
        ],
        identifierLabel: 'eCO User ID / Case Number',
        identifierPlaceholder: 'e.g. 1-1234567890',
        identifierHelp: 'Enter your eCO user handle or your most recent official registration case confirmation number.',
        troubleshooting: 'If the eCO site displays an outage or maintenance error, use Chrome or Safari during standard business hours (eCO performs scheduled maintenance on Sunday mornings).',
        officialUrl: 'https://www.copyright.gov/register/pa-sr.html'
    },
    mlc_membership: {
        id: 'mlc_membership',
        title: 'The Mechanical Licensing Collective',
        organization: 'The MLC',
        tagline: 'Manage U.S. digital audio mechanical royalties for musical-work shares you are entitled to administer.',
        category: 'royalties',
        difficulty: 'Easy (5 min)',
        feeDescription: 'Free membership (100% royalty payout with 0% commission)',
        accentColor: 'text-amber-400',
        badgeBg: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        icon: <DollarSign className="w-5 h-5 text-amber-400" />,
        whyItMatters: [
            'Interactive DSPs (Spotify, Apple Music, Amazon Music, Tidal) pay mechanical royalties directly to The MLC',
            'PROs (BMI/ASCAP) DO NOT collect mechanical royalties — only performance royalties',
            'Check your works and any existing administrator mandate before registering or claiming shares',
            'Zero administrative fee — operations are funded 100% by digital service providers by law'
        ],
        prerequisites: [
            'Self-administered songwriter or publisher status (you control your own publishing shares)',
            'Taxpayer identification number (SSN or company EIN for your music LLC)',
            'Direct ACH bank routing details for direct deposit payouts'
        ],
        steps: [
            {
                stepNumber: 1,
                title: 'Create Member Profile on The MLC Portal',
                instruction: 'Use The MLC Get Started flow to identify the right Hub. Join as a Member for shares you self-administer; owning a record label alone does not establish musical-work administration rights.',
                portalUrl: 'https://portal.themlc.com/',
                portalLabel: 'Open The MLC Portal',
                tip: 'If a publisher or administrator already represents these shares, check your agreement and contact them before creating a duplicate claim.'
            },
            {
                stepNumber: 2,
                title: 'Complete Direct Deposit Banking Setup',
                instruction: 'Submit your W-9/W-8BEN information and enter your checking account routing number for direct monthly electronic royalty distributions.',
                portalUrl: 'https://portal.themlc.com/member/banking',
                portalLabel: 'The MLC Banking Portal',
                tip: 'Royalties are distributed monthly with transparent song-by-song audit statements.'
            },
            {
                stepNumber: 3,
                title: 'Obtain Member ID & Index Musical Works',
                instruction: 'Copy your unique Member ID from your profile dashboard. Then claim existing song registrations or submit new works directly.',
                copyValue: 'MLC-',
                copyLabel: 'Copy Member ID Prefix',
                tip: 'Keep your MLC Member ID on file to link directly with indii CWR 2.2 export feeds.'
            }
        ],
        identifierLabel: 'The MLC Publisher / Member ID',
        identifierPlaceholder: 'e.g. MLC-1029384',
        identifierHelp: 'Found on your MLC portal profile page under Member Details.',
        troubleshooting: 'If your song title is already in the database under another publisher, use The MLC "Claim Shares" feature to claim your rightful writer/publisher ownership percentage.',
        officialUrl: 'https://www.themlc.com/membership'
    },
    pro_affiliation: {
        id: 'pro_affiliation',
        title: 'PRO Writer & Publisher Affiliation',
        organization: 'ASCAP / BMI / SESAC (CISAC)',
        tagline: 'Public performance royalties across streaming, radio, television, live performances, and international societies.',
        category: 'royalties',
        difficulty: 'Easy (5 min)',
        feeDescription: 'Review current writer/publisher fees and eligibility on each provider’s official application',
        accentColor: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
        icon: <Radio className="w-5 h-5 text-emerald-400" />,
        whyItMatters: [
            'Collects performance royalties whenever your composition is streamed, broadcast, or performed live',
            'Issues your authoritative 9 to 11-digit IPI (Interested Party Information) number, the global backbone of songwriter identity',
            'PRO affiliation concerns composition performance royalties; it does not establish ownership or authorize sync licensing',
            'Reciprocal agreements with international PROs (PRS, SACEM, GEMA, SOCAN) protect global earnings'
        ],
        prerequisites: [
            'Legal name, date of birth, and US SSN or international passport',
            'Your existing affiliations, territory and representation agreements; review any transfer restrictions before changing societies'
        ],
        steps: [
            {
                stepNumber: 1,
                title: 'Select Your PRO & Apply as Songwriter',
                instruction: 'Compare eligible societies and choose for yourself. Check current writer and publisher application terms separately, including fees and any existing affiliation restrictions.',
                portalUrl: 'https://online.bmi.com/',
                portalLabel: 'Open BMI Application',
                tip: 'BMI is one option, not an indii recommendation. ASCAP applications are available at ascap.com/join; consult other societies for their eligibility and invitation requirements.'
            },
            {
                stepNumber: 2,
                title: 'Review Publisher Representation',
                instruction: 'Check how your chosen society handles publisher shares and whether an existing publisher or administrator already represents yours. A separate company or publisher affiliation is not a universal requirement.',
                portalUrl: 'https://members.ascap.com/',
                portalLabel: 'Open ASCAP Members Portal',
                tip: 'Use your chosen society’s publisher guidance. Do not affiliate with a different society solely because its portal is linked here.'
            },
            {
                stepNumber: 3,
                title: 'Record Your Official IPI / CAE Number',
                instruction: 'After your society confirms affiliation, copy the IPI / CAE identifier it provides. Keep leading zeros and distinguish it from your account number.',
                tip: 'Never invent an IPI number. Saving a number in indii does not verify it with your society or CISAC.'
            }
        ],
        identifierLabel: 'Authoritative Writer / Publisher IPI Number',
        identifierPlaceholder: 'e.g. 00123456789',
        identifierHelp: 'The 9 to 11 digit number listed on your BMI or ASCAP member card / online profile.',
        troubleshooting: 'If your identifier is pending or unclear, contact your society. Processing times vary; retain the provider’s acknowledgement.',
        officialUrl: 'https://www.cisac.org/services/information-services/ipi'
    },
    soundexchange: {
        id: 'soundexchange',
        title: 'SoundExchange Digital Performance Rights',
        organization: 'SoundExchange',
        tagline: 'Section 114 non-interactive digital performance royalties from satellite radio (SiriusXM), Pandora, and webcasters.',
        category: 'royalties',
        difficulty: 'Easy (5 min)',
        feeDescription: 'Free registration',
        accentColor: 'text-cyan-400',
        badgeBg: 'bg-cyan-500/10',
        borderColor: 'border-cyan-500/30',
        icon: <Share2 className="w-5 h-5 text-cyan-400" />,
        whyItMatters: [
            'Collects eligible sound-recording performance royalties, distinct from the composition royalties handled by PROs',
            'Splits payouts directly: 50% to Master Rights Owner / Label, 45% to Featured Artist, and 5% to backing session musicians',
            'Unclaimed royalties can expire; consult SoundExchange about applicable periods and claims',
            'Payment depends on eligible uses, accepted claims, account requirements and applicable agreements'
        ],
        prerequisites: [
            'Featured recording artist name and Master sound recording copyright owner name',
            'Taxpayer ID (SSN or EIN) and direct ACH bank account info'
        ],
        steps: [
            {
                stepNumber: 1,
                title: 'Register for the Roles You Actually Hold',
                instruction: 'Open the SoundExchange portal and register. If you own your master recordings, select BOTH "Featured Artist" and "Sound Recording Copyright Owner (SRCO)".',
                portalUrl: 'https://sportal.soundexchange.com/',
                portalLabel: 'Open SoundExchange Portal',
                tip: 'Select both roles only if you are the featured artist and control the relevant recording rights. Role selection does not guarantee a payout or ownership share.'
            },
            {
                stepNumber: 2,
                title: 'Claim Your Track Repertoire',
                instruction: 'In SoundExchange, search for your released song titles and matching ISRCs. Claim your recordings so royalties route to your account.',
                portalUrl: 'https://www.soundexchange.com/repertoire-search/',
                portalLabel: 'Search SoundExchange Repertoire',
                tip: 'SoundExchange says unclaimed royalties can expire after three years. A claim does not guarantee retroactive payment.'
            },
            {
                stepNumber: 3,
                title: 'Record Your SoundExchange Account Number',
                instruction: 'Copy your assigned SoundExchange Account Number (SX-XXXXXX) from your profile and save it in indii Studio.',
                tip: 'This account identifier links into automated DDEX repertoire registration feeds.'
            }
        ],
        identifierLabel: 'SoundExchange Account Number',
        identifierPlaceholder: 'e.g. SX-1029384',
        identifierHelp: 'Displayed on your SoundExchange member dashboard (often prefixed with SX-).',
        troubleshooting: 'If another entity has claimed shares on your master recordings, initiate a dispute through the SoundExchange Claims portal with your distributor release receipt.',
        officialUrl: 'https://www.soundexchange.com/register/'
    },
    isrc_prefix: {
        id: 'isrc_prefix',
        title: 'US ISRC Rights Owner Prefix',
        organization: 'US ISRC Agency (RIAA)',
        tagline: 'Permanent 3-character Registrant Code enabling your music company to authoritatively mint and own master ISRCs.',
        category: 'identity',
        difficulty: 'Instant',
        feeDescription: '$95 one-time fee (lifetime ownership, up to 100,000 codes/year)',
        accentColor: 'text-purple-400',
        badgeBg: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30',
        icon: <Barcode className="w-5 h-5 text-purple-400" />,
        whyItMatters: [
            'Distributor-generated ISRCs belong to the distributor, creating severe lock-in during catalog migrations',
            'Your own official ISRC prefix (e.g. QZ-XXX) guarantees your brand permanently owns the legal provenance of every recording',
            'Distinct ISRCs are legally required for music videos, Dolby Atmos mixes, acoustic versions, and live performances',
            'One-time $95 investment yields 100,000 distinct ISRCs annually forever'
        ],
        prerequisites: [
            'Legal entity or official artist trade name',
            '$95 credit card payment for US ISRC Agency registration'
        ],
        steps: [
            {
                stepNumber: 1,
                title: 'Apply for an ISRC Registrant Code',
                instruction: 'Navigate to the US ISRC Agency online application. Select "Company/Individual applying for own recordings" and complete the registrant form.',
                portalUrl: 'https://redesign.usisrc.org/apply-for-an-isrc-account/?user-is-manager=false',
                portalLabel: 'Open US ISRC Agency Application',
                tip: 'Enter your legal business name or public artist name as the official Registrant Name.'
            },
            {
                stepNumber: 2,
                title: 'Receive Your Unique 3-Character Registrant Code',
                instruction: 'Upon approval (instant to 24 hours), the US ISRC Agency issues your 3-character registrant code (e.g. QZ9 or 9X2).',
                tip: 'Standard US ISRC format: Country (US) + Registrant Code (3 chars) + Year of Reference (2 digits) + Designation Code (5 digits).'
            },
            {
                stepNumber: 3,
                title: 'Save Code in indii Studio',
                instruction: 'Enter your registrant code below. indii Studio will automatically generate compliant, sequenced ISRCs for all your future releases.',
                copyValue: 'US-',
                copyLabel: 'Copy US Country Prefix',
                tip: 'Once saved, you can mint official master audio and video ISRCs with one click.'
            }
        ],
        identifierLabel: 'Registered Registrant Code (e.g. QZ-XXX)',
        identifierPlaceholder: 'e.g. QZ-XXX',
        identifierHelp: 'The 3-character code assigned by the US ISRC Agency.',
        troubleshooting: 'If you reside outside the United States, apply through your country\'s national ISRC agency (e.g. PPL in the UK, Re:Sound in Canada) to receive your national registrant code.',
        officialUrl: 'https://redesign.usisrc.org/'
    },
    upc_prefix: {
        id: 'upc_prefix',
        title: 'GS1 GTIN / UPC Barcode Ownership',
        organization: 'GS1 US',
        tagline: 'Official Global Trade Item Numbers (GTIN-12 / UPC) for digital albums, singles, and physical merchandise.',
        category: 'identity',
        difficulty: 'Instant',
        feeDescription: '$30 single GTIN (no renewal) or $250 initial / $50 annual prefix',
        accentColor: 'text-amber-300',
        badgeBg: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        icon: <Barcode className="w-5 h-5 text-amber-300" />,
        whyItMatters: [
            'Reseller barcodes from unofficial brokers can collide or be revoked by retailers and digital DSPs',
            'Official GS1 barcodes are permanently indexed in the global GS1 registry under your company name',
            'Required for official Billboard / Luminate / SoundScan commercial sales tracking',
            'Enables global retail point-of-sale scanning for vinyl, cassettes, CDs, and tour merchandise'
        ],
        prerequisites: [
            'Company or artist trading name',
            'Decision between a single GTIN ($30) or a multi-barcode company prefix ($250)'
        ],
        steps: [
            {
                stepNumber: 1,
                title: 'Purchase Official GS1 GTIN or Prefix',
                instruction: 'Open the GS1 US online store. For an upcoming single or EP, buy a single GS1 US GTIN ($30, no renewals). For a full record label with multiple releases and merchandise, get a Company Prefix.',
                portalUrl: 'https://store.gs1us.org/gs1-company-prefix/p',
                portalLabel: 'Open GS1 US Store',
                tip: 'GS1 single barcodes now have zero renewal fees, making official barcodes affordable for independent artists.'
            },
            {
                stepNumber: 2,
                title: 'Assign Barcode to Release in indii Studio',
                instruction: 'Copy your 12-digit UPC/GTIN from the GS1 Data Hub and record it in indii Studio for album distribution packaging.',
                tip: 'Never reuse a barcode once an album or single has been distributed.'
            }
        ],
        identifierLabel: 'GS1 Company Prefix or GTIN-12',
        identifierPlaceholder: 'e.g. 012345678901',
        identifierHelp: 'The 12-digit UPC or your multi-digit GS1 Company Prefix.',
        troubleshooting: 'Avoid free distributor UPCs if you plan on releasing physical vinyl or transferring distribution providers later.',
        officialUrl: 'https://store.gs1us.org/'
    },
    ddex_dpid: {
        id: 'ddex_dpid',
        title: 'DDEX Implementation Licence & DPID',
        organization: 'DDEX Standards Organization',
        tagline: 'Acquire your company Data Party Identifier (DPID) to authoritatively sign and send ERN 4.3 delivery feeds.',
        category: 'distribution',
        difficulty: 'Easy (5 min)',
        feeDescription: 'Free implementation licence (membership optional)',
        accentColor: 'text-blue-400',
        badgeBg: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        icon: <Building2 className="w-5 h-5 text-blue-400" />,
        whyItMatters: [
            'DPID serves as the digital passport for B2B music metadata exchange across DSPs and rights societies',
            'Enables direct Electronic Release Notification (ERN) delivery feeds with zero intermediaries',
            'Authoritatively identifies your entity in global CWR and MLC batch transmissions',
            'DDEX Implementation Licence is completely free for software implementations'
        ],
        prerequisites: [
            'Music label or distribution organization profile',
            'Company contact email address'
        ],
        steps: [
            {
                stepNumber: 1,
                title: 'Apply for Free DDEX Implementation Licence',
                instruction: 'Visit the DDEX portal and apply for a free Implementation Licence. Complete the form with your entity details.',
                portalUrl: 'https://ddex.net/implementation/frequently-asked-questions/',
                portalLabel: 'Open DDEX Licence Portal',
                tip: 'Full DDEX membership is optional and designed for major streaming services; the Implementation Licence is free.'
            },
            {
                stepNumber: 2,
                title: 'Receive and Record Assigned DPID',
                instruction: 'Once approved, DDEX will email your assigned Party ID (format: PADY-XXXXXXXX). Enter it into indii Studio.',
                tip: 'Your DPID authoritatively signs all outgoing XML feeds and CWR society batches.'
            }
        ],
        identifierLabel: 'Assigned DPID (Party ID)',
        identifierPlaceholder: 'e.g. PADY-XXXXXXXX',
        identifierHelp: 'The unique Party ID assigned to your organization by DDEX.',
        troubleshooting: 'If you distribute through indii distribution infrastructure, indii can proxy DDEX delivery feeds using our verified sender credentials.',
        officialUrl: 'https://ddex.net/'
    }
};

export interface RightsRegistrationWalkthroughModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPrerequisite?: FounderPrerequisiteId;
    readinessData?: PrerequisiteReports;
    onUpdatePrerequisite?: (id: FounderPrerequisiteId, value: string, completed: boolean) => void;
}

export const RightsRegistrationWalkthroughModal: React.FC<RightsRegistrationWalkthroughModalProps> = ({
    isOpen,
    onClose,
    initialPrerequisite = 'pro_affiliation',
    readinessData = {},
    onUpdatePrerequisite,
}) => {
    const titleId = useId();
    const [activePrereq, setActivePrereq] = useState<FounderPrerequisiteId>(initialPrerequisite);
    const [prevInitialPrereq, setPrevInitialPrereq] = useState<FounderPrerequisiteId>(initialPrerequisite);
    const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState<string>(() => readinessData[initialPrerequisite]?.value || '');
    const [prevActivePrereq, setPrevActivePrereq] = useState<FounderPrerequisiteId>(initialPrerequisite);
    const [isSavedRecently, setIsSavedRecently] = useState<boolean>(false);

    if (isOpen && initialPrerequisite !== prevInitialPrereq) {
        setPrevInitialPrereq(initialPrerequisite);
        setActivePrereq(initialPrerequisite);
    }

    if (activePrereq !== prevActivePrereq) {
        setPrevActivePrereq(activePrereq);
        setInputValue(readinessData[activePrereq]?.value || '');
        setIsSavedRecently(false);
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const currentGuide = RIGHTS_GUIDES[activePrereq] || RIGHTS_GUIDES.pro_affiliation;
    const currentState = readinessData[activePrereq] || reportPrerequisite('', false);

    const toggleStep = (stepNumber: number) => {
        const key = `${activePrereq}_step_${stepNumber}`;
        setCheckedSteps(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleCopy = (text: string, key: string) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            void navigator.clipboard.writeText(text);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        }
    };

    const handleOpenPortal = (url: string) => {
        if (typeof window !== 'undefined') {
            if ((window as unknown as { electronAPI?: { openExternal?: (u: string) => void } }).electronAPI?.openExternal) {
                (window as unknown as { electronAPI: { openExternal: (u: string) => void } }).electronAPI.openExternal(url);
            } else {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        }
    };

    const handleSaveIdentifier = (markCompleted: boolean) => {
        if (onUpdatePrerequisite) {
            onUpdatePrerequisite(activePrereq, inputValue, markCompleted);
        }
        setIsSavedRecently(true);
        setTimeout(() => setIsSavedRecently(false), 3000);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#14100C] border border-white/10 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_30px_rgba(255,184,0,0.1)] overflow-hidden text-gray-200"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#000000]/60 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#FFD700]/20 via-[#FFB800]/10 to-[#E65100]/20 border border-[#FFB800]/30 shadow-[0_0_15px_rgba(255,184,0,0.25)]">
                            <Compass size={22} className="text-[#FFD700]" />
                        </div>
                        <div>
                            <h2 id={titleId} className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                Rights & Royalty Copilot
                                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-md bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFD700]">
                                    Guided Walkthrough
                                </span>
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Guidance and progress tracking for rights registrations. You choose your providers and complete their applications.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
                        aria-label="Close walkthrough guide"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tab Selector */}
                <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5 bg-[#14100C]/70 overflow-x-auto scrollbar-none">
                    {(Object.keys(RIGHTS_GUIDES) as FounderPrerequisiteId[]).map(prereqId => {
                        const guide = RIGHTS_GUIDES[prereqId];
                        const isActive = activePrereq === prereqId;
                        const isCompleted = Boolean(readinessData[prereqId]?.completed);

                        return (
                            <button
                                key={prereqId}
                                onClick={() => setActivePrereq(prereqId)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                                    isActive
                                        ? 'bg-[#FFB800] text-black font-semibold shadow-[0_0_12px_rgba(255,184,0,0.3)]'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                                {guide.organization}
                            </button>
                        );
                    })}
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
                    {/* Organization Hero Banner */}
                    <div className="p-5 rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 relative overflow-hidden">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="space-y-1.5 max-w-xl">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
                                        {currentGuide.icon}
                                    </div>
                                    <h3 className="text-lg font-bold text-white tracking-tight">{currentGuide.title}</h3>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${currentGuide.badgeBg} ${currentGuide.accentColor} border ${currentGuide.borderColor}`}>
                                        {currentGuide.difficulty}
                                    </span>
                                    {currentState.completed ? (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Completed (self-reported)
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                            Not marked complete
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    {currentGuide.tagline}
                                </p>
                                <div className="text-[11px] font-mono text-[#FFD700]/90 pt-1">
                                    Statutory Fee: {currentGuide.feeDescription}
                                </div>
                            </div>

                            <button
                                onClick={() => handleOpenPortal(currentGuide.officialUrl)}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all shrink-0 self-start md:self-auto hover:border-[#FFB800]/50"
                            >
                                <ExternalLink size={13} className="text-[#FFD700]" />
                                <span>Open Official Portal</span>
                            </button>
                        </div>

                        {/* Why It Matters Callout */}
                        <div className="mt-4 pt-4 border-t border-white/5 grid sm:grid-cols-2 gap-2 text-xs">
                            {currentGuide.whyItMatters.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-gray-300">
                                    <ShieldCheck size={14} className="text-[#FFB800] shrink-0 mt-0.5" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Prerequisites Check */}
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-200/90 space-y-2">
                        <div className="flex items-center gap-2 font-semibold text-amber-300 uppercase tracking-wider text-[11px]">
                            <AlertTriangle size={14} />
                            Prerequisites & Documentation Check
                        </div>
                        <ul className="space-y-1 pl-5 list-disc text-gray-300 text-[11px]">
                            {currentGuide.prerequisites.map((req, i) => (
                                <li key={i}>{req}</li>
                            ))}
                        </ul>
                    </div>

                    {/* Step-by-Step Execution */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-white uppercase tracking-wider">
                            <span>Step-by-Step Assisted Execution</span>
                            <span className="text-gray-500 text-[11px] font-mono">{currentGuide.steps.length} Steps</span>
                        </div>

                        <div className="space-y-2.5">
                            {currentGuide.steps.map(step => {
                                const stepKey = `${activePrereq}_step_${step.stepNumber}`;
                                const isChecked = Boolean(checkedSteps[stepKey]);

                                return (
                                    <div
                                        key={step.stepNumber}
                                        className={`p-3.5 rounded-xl border transition-all ${
                                            isChecked
                                                ? 'bg-emerald-950/20 border-emerald-500/30'
                                                : 'bg-black/40 border-white/5 hover:border-white/10'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <button
                                                onClick={() => toggleStep(step.stepNumber)}
                                                className="mt-0.5 text-gray-400 hover:text-white transition-colors focus:outline-none"
                                                aria-label={`Mark step ${step.stepNumber} as ${isChecked ? 'incomplete' : 'complete'}`}
                                            >
                                                {isChecked ? (
                                                    <CheckCircle2 size={18} className="text-emerald-400" />
                                                ) : (
                                                    <Circle size={18} />
                                                )}
                                            </button>

                                            <div className="flex-1 space-y-1.5">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                                                            Step {step.stepNumber}
                                                        </span>
                                                        {step.title}
                                                    </h4>

                                                    <div className="flex items-center gap-2">
                                                        {step.copyValue && (
                                                            <button
                                                                onClick={() => handleCopy(step.copyValue!, `step_${step.stepNumber}`)}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-gray-300 border border-white/10 transition-colors"
                                                            >
                                                                {copiedKey === `step_${step.stepNumber}` ? (
                                                                    <>
                                                                        <Check size={10} className="text-emerald-400" />
                                                                        <span>Copied</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Copy size={10} />
                                                                        <span>{step.copyLabel || 'Copy'}</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        )}

                                                        {step.portalUrl && (
                                                            <button
                                                                onClick={() => handleOpenPortal(step.portalUrl!)}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FFB800]/10 hover:bg-[#FFB800]/20 text-[#FFD700] text-[10px] font-semibold border border-[#FFB800]/30 transition-all"
                                                            >
                                                                <span>{step.portalLabel || 'Launch Portal'}</span>
                                                                <ExternalLink size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <p className="text-xs text-gray-300 leading-relaxed">
                                                    {step.instruction}
                                                </p>

                                                {step.tip && (
                                                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px] text-gray-400 flex items-start gap-2">
                                                        <Sparkles size={12} className="text-[#FFD700] shrink-0 mt-0.5" />
                                                        <span>{step.tip}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Identifier Verification Card */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-black/60 to-[#14100C] border border-[#FFB800]/20 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                    <FileCheck2 size={14} className="text-[#FFD700]" />
                                    Provider Identifier — Self-Reported
                                </h4>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    {currentGuide.identifierHelp}
                                </p>
                            </div>

                            {isSavedRecently && (
                                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                                    <Check size={12} /> Saved to Vault
                                </span>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                placeholder={currentGuide.identifierPlaceholder}
                                className="flex-1 bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-[#FFB800] focus:ring-1 focus:ring-[#FFB800]"
                                aria-label={currentGuide.identifierLabel}
                            />

                            <button
                                type="button"
                                onClick={() => handleSaveIdentifier(true)}
                                disabled={!inputValue.trim()}
                                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FFB800] text-black text-xs font-bold hover:brightness-110 transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-[0_0_12px_rgba(255,184,0,0.25)]"
                            >
                                <Save size={13} />
                                <span>Save as Completed</span>
                            </button>
                        </div>
                    </div>

                    {/* Troubleshooting Footnote */}
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-gray-400">
                        <strong className="text-gray-200">Legal Standard & Troubleshooting:</strong>{' '}
                        {currentGuide.troubleshooting}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-white/10 bg-[#000000]/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] text-gray-500">
                        Educational guidance only. You handle provider sign-in, terms, sensitive information and final submission. Saved completion is self-reported, not provider verification or legal/tax advice.
                    </p>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Close Guide
                        </button>

                        <button
                            onClick={() => handleOpenPortal(currentGuide.officialUrl)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-all flex items-center gap-2"
                        >
                            <span>Open {currentGuide.organization}</span>
                            <ArrowRight size={13} />
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
