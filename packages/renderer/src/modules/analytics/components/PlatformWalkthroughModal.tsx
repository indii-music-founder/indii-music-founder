/**
 * PlatformWalkthroughModal.tsx
 *
 * Interactive Copilot & Walkthrough Guide for Growth Intelligence & Social Integrations:
 * Guides artists step-by-step through configuring and authorizing third-party platform APIs
 * (Instagram Graph API, YouTube Studio & Google OAuth, TikTok Content Posting API,
 * Twitter / X API v2, Spotify PKCE, and Apple Music for Artists).
 *
 * Follows Sovereign Luxury & Analog Craft design aesthetic (Obsidian #14100C,
 * Champagne Gold #FFD700/#FFB800, and Molten Ingot gradients).
 */

import React, { useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
    Loader2
} from 'lucide-react';
import type { PlatformConnectionStatus } from '@/services/analytics/PlatformDataService';

export type WalkthroughPlatformId = keyof PlatformConnectionStatus;

export interface PlatformWalkthroughGuide {
    id: WalkthroughPlatformId;
    name: string;
    tagline: string;
    difficulty: 'Instant' | 'Easy (2 min)' | 'Moderate (3 min)' | 'Partner Verification';
    accentColor: string;
    badgeBg: string;
    borderColor: string;
    capabilities: string[];
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
    troubleshooting: string;
    supportUrl?: string;
}

export const PLATFORM_GUIDES: Record<WalkthroughPlatformId, PlatformWalkthroughGuide> = {
    instagram: {
        id: 'instagram',
        name: 'Instagram Reels & Graph API',
        tagline: 'Automated video Reels posting, carousel teasers, and daily reach metrics.',
        difficulty: 'Moderate (3 min)',
        accentColor: 'text-[#FFB800]',
        badgeBg: 'bg-[#FFB800]/10',
        borderColor: 'border-[#FFB800]/30',
        capabilities: [
            'Direct scheduled publishing to Instagram Reels',
            'Full audio track tag and hashtag synchronization',
            'Daily video plays, impressions, and engagement metrics',
            'Audience growth telemetry into Growth Intelligence'
        ],
        prerequisites: [
            'Instagram account switched to Creator or Business (free in IG mobile app)',
            'Instagram account connected to an owned Facebook Page (required by Meta Graph API)',
            'Admin role on the associated Facebook Page'
        ],
        steps: [
            {
                stepNumber: 1,
                title: 'Verify Professional Account Type',
                instruction: 'Open the Instagram app on your phone. Go to Settings and privacy → Account type and tools. Tap "Switch to professional account" (Creator or Business) if you are currently on a personal account.',
                portalUrl: 'https://www.instagram.com',
                portalLabel: 'Open Instagram Web',
                tip: 'Meta Graph API rejects personal accounts. Switching to Creator is free and takes 30 seconds.'
            },
            {
                stepNumber: 2,
                title: 'Link to a Facebook Page',
                instruction: 'Meta publishing requires an associated Facebook Page. In Meta Business Suite, navigate to Settings → Linked Accounts → Instagram, and connect your Instagram account.',
                portalUrl: 'https://business.facebook.com',
                portalLabel: 'Open Meta Business Suite',
                tip: 'If you do not have a Facebook Page for your music, create a simple Page named after your artist persona.'
            },
            {
                stepNumber: 3,
                title: 'Authorize indii.music Permissions',
                instruction: 'Click "Connect Instagram" below. Meta will present an authorization modal. Select your Facebook Page and Instagram Account, and grant the requested publishing and insights scopes.',
                tip: 'Ensure all permissions (Content Publishing, Insights, and Page Access) are toggled ON.'
            }
        ],
        troubleshooting: 'If Meta returns "No Instagram Business account found", ensure your Instagram account is linked to your Facebook Page in Meta Business Suite and not just in the mobile app Accounts Center.',
        supportUrl: 'https://developers.facebook.com/docs/instagram-platform'
    },
    youtube: {
        id: 'youtube',
        name: 'YouTube Shorts & Channel Analytics',
        tagline: 'Direct 1080p music video and Shorts delivery with subscriber growth tracking.',
        difficulty: 'Easy (2 min)',
        accentColor: 'text-red-400',
        badgeBg: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        capabilities: [
            '1-click Shorts and full-length visualizer upload from NLE timeline',
            'Automatic YouTube video title, description, and tags injection',
            '30-day view velocity, watch time minutes, and subscriber gains',
            'Geographic listener breakdown by country'
        ],
        prerequisites: [
            'Active Google account (e.g. wiil@indii.music or your channel email)',
            'YouTube channel established with at least 1 public or unlisted video',
            'If testing in staging/dev: Email added to Google Cloud Console Test Users'
        ],
        steps: [
            {
                stepNumber: 1,
                title: 'Verify YouTube Studio Channel',
                instruction: 'Log in to YouTube Studio to ensure your official artist channel is selected as the default channel on your Google Account.',
                portalUrl: 'https://studio.youtube.com',
                portalLabel: 'Open YouTube Studio',
                tip: 'Brand accounts can be selected during the Google OAuth permission consent screen.'
            },
            {
                stepNumber: 2,
                title: 'Verify Test User Access (During Launch Phase)',
                instruction: 'While the app is in launch testing, Google OAuth requires your email to be in the "Test users" list in Google Cloud Console to unblock sensitive youtube.upload scopes.',
                portalUrl: 'https://console.cloud.google.com/apis/credentials/consent?project=indii-music-founder',
                portalLabel: 'Open GCP OAuth Consent Screen',
                tip: 'Add your primary Google email under "Test users" and click Save.'
            },
            {
                stepNumber: 3,
                title: 'Connect & Grant YouTube Scopes',
                instruction: 'Click "Connect YouTube" below. Choose your Google account and grant permission for video management and YouTube Analytics.',
                tip: 'Your tokens are securely stored in your private user vault and never exposed client-side.'
            }
        ],
        troubleshooting: 'If Google displays "This app is blocked (Error 403: access_denied)", your email has not yet been added to the GCP OAuth Test users list. Follow Step 2 to add it in 60 seconds.',
        supportUrl: 'https://studio.youtube.com'
    },
    tiktok: {
        id: 'tiktok',
        name: 'TikTok Content Posting API',
        tagline: 'Direct short-form video auto-publishing and TikTok sound engagement analytics.',
        difficulty: 'Easy (2 min)',
        accentColor: 'text-pink-400',
        badgeBg: 'bg-pink-500/10',
        borderColor: 'border-pink-500/30',
        capabilities: [
            'Autonomous dispatch of 15s/30s teaser clips to TikTok',
            'Video view velocity, likes, and comment engagement rate tracking',
            'Sound usage metrics across the 30-day release timeline',
            'Direct draft or direct publish routing'
        ],
        prerequisites: [
            'Active TikTok account (@indii.music or your official handle)',
            'Switched to Business Account in TikTok mobile settings (free)'
        ],
        steps: [
            {
                stepNumber: 1,
                title: 'Verify TikTok Account & Handle',
                instruction: 'Ensure your TikTok profile is claimed and logged in on this browser or your mobile phone.',
                portalUrl: 'https://www.tiktok.com',
                portalLabel: 'Open TikTok Web',
                tip: 'In the TikTok app: Profile → Menu → Settings and Privacy → Account → Switch to Business Account.'
            },
            {
                stepNumber: 2,
                title: 'Authorize Content Posting API',
                instruction: 'Click "Connect TikTok" below. TikTok will prompt you to authorize indii.music for video sharing and video statistics.',
                tip: 'Make sure "Post videos to TikTok" and "Read user info and stats" are checked.'
            }
        ],
        troubleshooting: 'If TikTok authorization hangs, ensure your browser pop-up blocker is disabled for tiktok.com.',
        supportUrl: 'https://www.tiktok.com/creator-center'
    },
    twitter: {
        id: 'twitter',
        name: 'Twitter / X API v2',
        tagline: 'Autonomous campaign announcement threads, drop links, and engagement tracking.',
        difficulty: 'Easy (2 min)',
        accentColor: 'text-sky-400',
        badgeBg: 'bg-sky-500/10',
        borderColor: 'border-sky-500/30',
        capabilities: [
            'Autonomous tweet and thread posting on release day and milestones',
            'Hashtag optimization and image attachment support',
            'Impression counts, retweets, and follower growth monitoring',
            'Idempotent delivery preventing duplicate tweets'
        ],
        prerequisites: [
            'Active Twitter / X account (e.g. @indii_music or artist handle)',
            'Verified email or phone number attached to your X profile'
        ],
        steps: [
            {
                stepNumber: 1,
                title: 'Ensure X Session is Active',
                instruction: 'Open X on this browser to confirm you are logged into the correct official artist account.',
                portalUrl: 'https://x.com',
                portalLabel: 'Open X / Twitter',
                tip: 'If creating a fresh account, use the X Mobile App or "Continue with Google" if the web signup errors.'
            },
            {
                stepNumber: 2,
                title: 'Grant Post & Read Permissions',
                instruction: 'Click "Connect X / Twitter" to initiate the OAuth 2.0 authorization sequence. Confirm permission for indii.music to post tweets and view basic user info.',
                tip: 'indii.music will never DM fans or delete tweets without your explicit instruction.'
            }
        ],
        troubleshooting: 'If you encounter rate limits on X, wait 5 minutes before re-initiating the OAuth grant.',
        supportUrl: 'https://developer.x.com'
    },
    spotify: {
        id: 'spotify',
        name: 'Spotify PKCE & Artist Integration',
        tagline: 'Audio DNA energy/BPM analysis, top 50 track popularity, and streaming velocity.',
        difficulty: 'Instant',
        accentColor: 'text-green-400',
        badgeBg: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        capabilities: [
            'Audio DNA extraction (BPM, danceability, acousticness, key signature)',
            'Top 50 tracks popularity scoring and live ranking',
            'Recently played history to inform marketing campaign timing',
            'Release catalog matching against Spotify DSP databases'
        ],
        prerequisites: [
            'Spotify listener or artist account'
        ],
        steps: [
            {
                stepNumber: 1,
                title: 'Connect via Spotify PKCE OAuth',
                instruction: 'Click "Connect Spotify" below. You will be redirected to Spotify’s official secure login dialog to grant read access to your top tracks and playback profile.',
                tip: 'Uses high-security PKCE OAuth — no client secrets are ever transmitted.'
            },
            {
                stepNumber: 2,
                title: 'Claim Your Spotify for Artists Profile',
                instruction: 'To upload Canvas looping videos and view playlist pitch feedback, claim your official Spotify for Artists profile.',
                portalUrl: 'https://artists.spotify.com',
                portalLabel: 'Open Spotify for Artists',
                tip: 'Verification is instant if your distributor (DistroKid, TuneCore, etc.) has already delivered your first song.'
            }
        ],
        troubleshooting: 'If top tracks do not appear immediately, ensure you have listened to music or released tracks under this Spotify profile in the last 30 days.',
        supportUrl: 'https://artists.spotify.com'
    },
    apple_music: {
        id: 'apple_music',
        name: 'Apple Music for Artists',
        tagline: 'Real-time global streaming trends, Shazam milestones, and city-level listener data.',
        difficulty: 'Partner Verification',
        accentColor: 'text-rose-400',
        badgeBg: 'bg-rose-500/10',
        borderColor: 'border-rose-500/30',
        capabilities: [
            'Real-time Apple Music stream velocity and listener count',
            'Shazam tags and trending city telemetry',
            'Editorial playlist placement detection and alert telemetry',
            'Radio spins and milestone badging'
        ],
        prerequisites: [
            'At least 1 active release distributed to Apple Music',
            'Apple ID for claiming your artist profile at artists.apple.com'
        ],
        steps: [
            {
                stepNumber: 1,
                title: 'Claim Official Profile on Apple Music for Artists',
                instruction: 'Go to artists.apple.com or download the Apple Music for Artists iOS app. Sign in with your Apple ID and search for your artist name.',
                portalUrl: 'https://artists.apple.com',
                portalLabel: 'Open Apple Music for Artists',
                tip: 'Submit verification using your distributor credentials (e.g. DistroKid login) or official artist website.'
            },
            {
                stepNumber: 2,
                title: 'Obtain Artist Identifier & URL',
                instruction: 'Once approved by Apple, open your artist profile in Apple Music and copy your public Artist URL (e.g., https://music.apple.com/us/artist/.../123456789).',
                tip: 'The numeric ID at the end of the URL is your authoritative Apple Music Artist ID.'
            },
            {
                stepNumber: 3,
                title: 'Backend Integration Standby',
                instruction: 'Apple Music analytics require an approved enterprise MusicKit backend partner certificate. Direct client-side tokens are disabled for security until your organization gateway is provisioned.',
                tip: 'Your profile link is preserved in your Brand Kit so indii can auto-query Apple Music as soon as the gateway activates.'
            }
        ],
        troubleshooting: 'Apple Music does not offer standard OAuth for individual artists. Only verified Apple Music for Artists profiles and enterprise developer tokens can access real telemetry.',
        supportUrl: 'https://artists.apple.com'
    }
};

export interface PlatformWalkthroughModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPlatform?: WalkthroughPlatformId;
    connectionStatus: PlatformConnectionStatus;
    onConnectPlatform: (platformId: WalkthroughPlatformId) => Promise<void>;
    isConnecting?: boolean;
}

export const PlatformWalkthroughModal: React.FC<PlatformWalkthroughModalProps> = ({
    isOpen,
    onClose,
    initialPlatform = 'instagram',
    connectionStatus,
    onConnectPlatform,
    isConnecting = false
}) => {
    const titleId = useId();
    const [activePlatform, setActivePlatform] = useState<WalkthroughPlatformId>(initialPlatform);
    const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    useEffect(() => {
        if (initialPlatform) {
            setActivePlatform(initialPlatform);
        }
    }, [initialPlatform]);

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

    const currentGuide = PLATFORM_GUIDES[activePlatform] || PLATFORM_GUIDES.instagram;
    const isCurrentConnected = Boolean(connectionStatus[activePlatform]);

    const toggleStep = (stepNumber: number) => {
        const key = `${activePlatform}_step_${stepNumber}`;
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
                className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#14100C] border border-white/10 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_30px_rgba(255,184,0,0.1)] overflow-hidden text-gray-200"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#000000]/60 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#FFD700]/20 via-[#FFB800]/10 to-[#E65100]/20 border border-[#FFB800]/30 shadow-[0_0_15px_rgba(255,184,0,0.25)]">
                            <Compass size={22} className="text-[#FFD700]" />
                        </div>
                        <div>
                            <h2 id={titleId} className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                Platform Connection Copilot
                                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-md bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFD700]">
                                    Guided Walkthrough
                                </span>
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Step-by-step assistant for connecting official APIs, social accounts, and streaming analytics.
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

                {/* Platform Selector Tabs */}
                <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5 bg-[#14100C]/70 overflow-x-auto scrollbar-none">
                    {(Object.keys(PLATFORM_GUIDES) as WalkthroughPlatformId[]).map(platformId => {
                        const guide = PLATFORM_GUIDES[platformId];
                        const isActive = activePlatform === platformId;
                        const isConnected = Boolean(connectionStatus[platformId]);

                        return (
                            <button
                                key={platformId}
                                onClick={() => setActivePlatform(platformId)}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                                    isActive
                                        ? 'bg-[#FFB800]/15 text-[#FFD700] border border-[#FFB800]/40 shadow-[0_0_15px_rgba(255,184,0,0.15)]'
                                        : 'bg-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/10 border border-white/5'
                                }`}
                            >
                                {isConnected ? (
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                                ) : (
                                    <span className="w-2 h-2 rounded-full bg-gray-600" />
                                )}
                                <span>{guide.name.split(' ')[0]}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Platform Overview Banner */}
                    <div className="p-5 rounded-2xl bg-[#000000]/50 border border-white/10 backdrop-blur-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Sparkles size={80} className="text-[#FFD700]" />
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <h3 className="text-xl font-bold text-white tracking-tight">
                                        {currentGuide.name}
                                    </h3>
                                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${currentGuide.badgeBg} ${currentGuide.accentColor} border ${currentGuide.borderColor}`}>
                                        {currentGuide.difficulty}
                                    </span>
                                    {isCurrentConnected ? (
                                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                                            <CheckCircle2 size={12} /> Connected
                                        </span>
                                    ) : (
                                        <span className="text-[11px] text-gray-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                                            Ready to Connect
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-300 mt-1">
                                    {currentGuide.tagline}
                                </p>
                            </div>
                        </div>

                        {/* Capabilities Pill Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                            {currentGuide.capabilities.map((cap, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                                    <ShieldCheck size={14} className="text-[#FFD700] shrink-0" />
                                    <span>{cap}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Prerequisites */}
                    {currentGuide.prerequisites.length > 0 && (
                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-2 uppercase tracking-wider">
                                <AlertTriangle size={14} /> Prerequisites Check
                            </div>
                            <ul className="space-y-1.5 text-xs text-amber-100/90 pl-5 list-disc">
                                {currentGuide.prerequisites.map((req, i) => (
                                    <li key={i}>{req}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Step-by-Step Interactive Walkthrough */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                Step-by-Step Assisted Execution
                            </h4>
                            <span className="text-xs font-mono text-gray-400">
                                {currentGuide.steps.length} Steps
                            </span>
                        </div>

                        <div className="space-y-3">
                            {currentGuide.steps.map(step => {
                                const stepKey = `${activePlatform}_step_${step.stepNumber}`;
                                const isChecked = Boolean(checkedSteps[stepKey]);

                                return (
                                    <div
                                        key={step.stepNumber}
                                        className={`p-4 rounded-xl border transition-all ${
                                            isChecked
                                                ? 'bg-[#14100C]/90 border-emerald-500/30'
                                                : 'bg-[#14100C]/70 border-white/10 hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <button
                                                onClick={() => toggleStep(step.stepNumber)}
                                                className="mt-0.5 text-gray-400 hover:text-emerald-400 transition-colors focus:outline-none"
                                                aria-label={`Mark step ${step.stepNumber} as ${isChecked ? 'incomplete' : 'complete'}`}
                                            >
                                                {isChecked ? (
                                                    <CheckCircle2 size={18} className="text-emerald-400 fill-emerald-500/20" />
                                                ) : (
                                                    <Circle size={18} className="text-gray-500" />
                                                )}
                                            </button>

                                            <div className="flex-1 space-y-2">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                    <h5 className="text-sm font-bold text-white flex items-center gap-2">
                                                        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-white/10 text-gray-300">
                                                            Step {step.stepNumber}
                                                        </span>
                                                        {step.title}
                                                    </h5>

                                                    {step.portalUrl && (
                                                        <button
                                                            onClick={() => handleOpenPortal(step.portalUrl!)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-[#FFB800]/15 hover:text-[#FFD700] border border-white/10 text-xs font-medium text-gray-300 transition-all w-fit"
                                                        >
                                                            <span>{step.portalLabel || 'Open Portal'}</span>
                                                            <ExternalLink size={12} />
                                                        </button>
                                                    )}
                                                </div>

                                                <p className="text-xs text-gray-300 leading-relaxed">
                                                    {step.instruction}
                                                </p>

                                                {step.copyValue && (
                                                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/5 text-xs font-mono text-gray-300">
                                                        <span className="truncate mr-2">{step.copyValue}</span>
                                                        <button
                                                            onClick={() => handleCopy(step.copyValue!, stepKey)}
                                                            className="flex items-center gap-1 text-[11px] text-[#FFB800] hover:text-[#FFD700] px-2 py-1 rounded bg-[#FFB800]/10 shrink-0"
                                                        >
                                                            {copiedKey === stepKey ? <Check size={12} /> : <Copy size={12} />}
                                                            <span>{copiedKey === stepKey ? 'Copied' : (step.copyLabel || 'Copy')}</span>
                                                        </button>
                                                    </div>
                                                )}

                                                {step.tip && (
                                                    <div className="text-[11px] text-gray-400 bg-white/5 px-3 py-1.5 rounded-lg border-l-2 border-[#FFB800]">
                                                        💡 {step.tip}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Troubleshooting Footnote */}
                    {currentGuide.troubleshooting && (
                        <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs text-gray-400 space-y-1">
                            <span className="font-bold text-gray-300">Troubleshooting Note: </span>
                            {currentGuide.troubleshooting}
                        </div>
                    )}
                </div>

                {/* Footer Action Dock */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-[#000000]/60 backdrop-blur-md">
                    <div className="text-xs text-gray-400">
                        {isCurrentConnected ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                                <CheckCircle2 size={14} /> Ready for automated campaign dispatch
                            </span>
                        ) : (
                            <span>All tokens are cryptographically secured inside your private user vault.</span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
                        >
                            Close Guide
                        </button>

                        <button
                            onClick={() => onConnectPlatform(activePlatform)}
                            disabled={isConnecting}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#E65100] text-black font-black text-xs px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(255,184,0,0.35)] hover:shadow-[0_0_28px_rgba(255,184,0,0.55)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Connecting...</span>
                                </>
                            ) : isCurrentConnected ? (
                                <>
                                    <CheckCircle2 size={14} />
                                    <span>Re-authenticate {currentGuide.name.split(' ')[0]}</span>
                                </>
                            ) : (
                                <>
                                    <span>Connect {currentGuide.name.split(' ')[0]} Now</span>
                                    <ArrowRight size={14} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
