/**
 * Profile Settings Section
 *
 * Manages personal information: display name, avatar, bio, email.
 * Handles Firebase Auth profile updates and Firestore user document sync.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Camera, Save, X, RefreshCw } from 'lucide-react';
import { StoreState, useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import FounderBadge from '../components/FounderBadge';
import { SectionHeader } from './SettingsShared';

const ProfileSection: React.FC = () => {
    const { user, userProfile } = useStore(useShallow((s: StoreState) => ({
        user: s.user,
        userProfile: s.userProfile,
    })));
    const { showToast } = useToast();

    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [bio, setBio] = useState(userProfile?.bio || '');
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        setDisplayName(user?.displayName || '');
        setBio(userProfile?.bio || '');
    }, [user, userProfile]);

    const handleSave = async () => {
        if (!user || !dirty) return;
        setSaving(true);
        try {
            // Update Firebase Auth profile
            if (displayName !== user.displayName) {
                await updateProfile(user, { displayName });
            }
            // Update Firestore user document
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                displayName,
                bio,
                updatedAt: new Date().toISOString(),
            });
            setDirty(false);
            showToast('Profile updated', 'success');
            logger.info('[Settings] Profile updated');
        } catch (err: unknown) {
            logger.error('[Settings] Profile update failed:', err);
            showToast('Failed to update profile', 'error');
        } finally {
            setSaving(false);
        }
    };

    const getInitials = () => {
        const name = displayName || user?.email || 'U';
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div>
            <SectionHeader title="Profile" description="Manage your personal information and how others see you." />

            {/* Avatar */}
            <div className="flex items-center gap-5 mb-8">
                <div className="relative group">
                    {user?.photoURL ? (
                        <img
                            src={user.photoURL}
                            alt="Avatar"
                            className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-700"
                        />
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center border-2 border-slate-700">
                            <span className="text-2xl font-bold text-white">{getInitials()}</span>
                        </div>
                    )}
                    <button className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera size={20} className="text-white" />
                    </button>
                </div>
                <div>
                    <p className="text-sm font-medium text-white">{displayName || 'No name set'}</p>
                    <p className="text-xs text-slate-500">{user?.email || 'No email'}</p>
                    <p className="text-xs text-slate-600 mt-1">
                        UID: {user?.uid?.substring(0, 8)}...
                    </p>
                </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1.5">Display Name</label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => { setDisplayName(e.target.value); setDirty(true); }}
                        className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-all"
                        placeholder="Your display name"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1.5">Bio</label>
                    <textarea
                        value={bio}
                        onChange={(e) => { setBio(e.target.value); setDirty(true); }}
                        rows={3}
                        className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-all resize-none"
                        placeholder="Tell us about yourself..."
                    />
                    <p className="text-xs text-slate-600 mt-1">{bio.length}/280 characters</p>
                </div>

                <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1.5">Email</label>
                    <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-600 mt-1">Email cannot be changed directly. Contact support.</p>
                </div>

                {dirty && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                            onClick={() => {
                                setDisplayName(user?.displayName || '');
                                setBio(userProfile?.bio || '');
                                setDirty(false);
                            }}
                            className="flex items-center gap-2 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors"
                        >
                            <X size={14} /> Cancel
                        </button>
                    </motion.div>
                )}
            </div>

            {/* Founder badge — only visible for users with FOUNDER tier */}
            <FounderBadge />
        </div>
    );
};

export default ProfileSection;
