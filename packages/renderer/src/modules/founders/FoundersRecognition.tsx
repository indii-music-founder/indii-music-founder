import React from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { ArrowLeft, Award, Share2 } from 'lucide-react';
import { FOUNDERS, type FounderRecord } from '@/config/founders';
import { ShareSheet } from '@/components/share/ShareSheet';
import { SIGNATURE_BUTTON_BASE, SIGNATURE_BUTTON_TONES } from '@shared/share/signatureButton';
import type { UserProfile } from '@/types/User';

const GOLD_TONE = SIGNATURE_BUTTON_TONES.gold;

/**
 * Determines whether a founder covenant record belongs to the currently signed-in
 * verified founder viewer. Matches on authoritative UID first, falling back to
 * normalized display name only when the record has no UID bound.
 */
function isMatchingFounderRecord(
    founder: FounderRecord,
    userProfile: Partial<UserProfile> | null | undefined,
    authUid?: string | null,
    authDisplayName?: string | null,
): boolean {
    if (!userProfile) return false;
    const isFounder = userProfile.subscriptionTier === 'founder'
        || userProfile.tier === 'founder'
        || userProfile.isFounder === true;
    if (!isFounder) return false;

    const viewerUid = userProfile.uid || userProfile.id || authUid || '';
    if (founder.uid) {
        return Boolean(viewerUid) && founder.uid === viewerUid;
    }

    const viewerName = (userProfile.displayName ?? authDisplayName ?? '').trim().toLowerCase();
    const recordName = founder.name.trim().toLowerCase();
    return Boolean(viewerName) && recordName === viewerName;
}

export default function FoundersRecognition() {
    const { setModule, userProfile, user } = useStore(
        useShallow(state => ({
            setModule: state.setModule,
            userProfile: state.userProfile,
            user: state.user,
        }))
    );

    const handleShareSeat = (founder: FounderRecord) => {
        void ShareSheet.call({
            title: 'Founder Seat Card',
            template: {
                kind: 'founder',
                name: founder.name,
                seat: founder.seat,
                joinedAt: founder.joinedAt,
                verificationHash: founder.verificationHash,
            },
            options: {
                brandColors: ['#FFB800', '#E65100'],
            },
        });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-full p-6 md:p-8 overflow-y-auto relative bg-background text-foreground">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/5 via-background to-background pointer-events-none" />

            <button
                onClick={() => setModule('dashboard')}
                className="fixed top-6 left-6 z-20 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-200 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg px-1"
            >
                <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                Return to Studio
            </button>

            <div className="z-10 max-w-3xl w-full text-center mt-12">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest uppercase mb-8">
                    <Award size={14} /> Founder Recognition
                </div>

                <h1 className="text-xl font-black tracking-tighter text-white mb-4">
                    Meet the <span className="text-amber-400">Founders</span>.
                </h1>

                <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-12">
                    These early believers backed indii's mission to build an artist-controlled operating system for the business behind the music.
                    Their commitment enabled this platform to exist.
                </p>

                {FOUNDERS.length === 0 ? (
                    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-12 text-center">
                        <p className="text-gray-400">Founder recognition records will appear here as early supporters join the mission.</p>
                        <p className="text-xs text-gray-600 mt-4">
                            Secure Founder Access for $2,500 and receive lifetime platform access + permanent recognition.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {FOUNDERS.map((founder) => {
                            const isOwnSeat = isMatchingFounderRecord(
                                founder,
                                userProfile,
                                user?.uid,
                                user?.displayName,
                            );
                            return (
                                <div
                                    key={founder.verificationHash}
                                    className="bg-white/[0.02] border border-white/10 rounded-lg p-4 text-left hover:border-amber-500/30 transition-all"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="font-bold text-white text-sm">{founder.name}</p>
                                            <p className="text-xs text-gray-500 font-mono">Seat #{founder.seat}</p>
                                        </div>
                                        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                                            Founder
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 mt-2">
                                        <p className="text-xs text-gray-600">
                                            Joined {new Date(founder.joinedAt).toLocaleDateString()}
                                        </p>
                                        {isOwnSeat && (
                                            <button
                                                type="button"
                                                onClick={() => handleShareSeat(founder)}
                                                className={`${SIGNATURE_BUTTON_BASE} ${GOLD_TONE.button} px-3 py-1.5 text-xs`}
                                            >
                                                <Share2 size={13} className={GOLD_TONE.icon} />
                                                <span className={GOLD_TONE.label}>Share my seat</span>
                                                <span aria-hidden="true" className={GOLD_TONE.sweep} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-6 max-w-2xl mx-auto mt-12 text-left">
                    <h3 className="text-amber-400 font-semibold mb-2">About Founder Access</h3>
                    <p className="text-sm text-gray-400 mb-3">
                        Founder Access grants lifetime, full-platform access including:
                    </p>
                    <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                        <li>All current and future founder-level modules and features</li>
                        <li>Boardroom and Conductor access</li>
                        <li>Beta participation and priority feature voting</li>
                        <li>Desktop application installers (Mac + Windows)</li>
                        <li>Permanent founder recognition in the indii platform</li>
                    </ul>
                    <p className="text-xs text-gray-600 mt-3">
                        Founder Access is available for $2,500 (one-time payment).
                        Future pricing will increase as indii moves toward wider release.
                    </p>
                </div>
            </div>
        </div>
    );
}
