import { useTranslation } from 'react-i18next';
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
import { UserProfile } from '@/types/User';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { updateProfile } from 'firebase/auth';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import FounderBadge from '../components/FounderBadge';
import { getColorForModule } from '@/core/theme/moduleColors';
import { SectionHeader } from './SettingsShared';
import { StorageService } from '@/services/StorageService';

const ProfileSection: React.FC = () => {
    const { t } = useTranslation();
    const { user, userProfile, setUserProfile } = useStore(useShallow((s: StoreState) => ({
        user: s.user,
        userProfile: s.userProfile,
        setUserProfile: s.setUserProfile,
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
            
            // Systematically update the userProfile through setUserProfile store action
            const updatedProfile = {
                ...(userProfile || {}),
                id: user.uid,
                uid: user.uid,
                email: user.email || (userProfile?.email || ''),
                displayName,
                bio,
            };

            await setUserProfile(updatedProfile as unknown as UserProfile);

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

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        
        try {
            setSaving(true);
            const path = `avatars/${user.uid}/${Date.now()}_${file.name}`;
            const photoURL = await StorageService.uploadFile(file, path);
            
            await updateProfile(user, { photoURL });
            await setUserProfile({ ...userProfile, photoURL } as unknown as UserProfile);
            
            showToast('Avatar updated successfully', 'success');
        } catch (err) {
            logger.error('[Settings] Avatar upload failed:', err);
            showToast('Failed to upload avatar', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <SectionHeader title={t('settings.sections.profile.title')} description={t('settings.sections.profile.description')} />

            {/* Avatar */}
            <div className="flex items-center gap-5 mb-8">
                <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatar-upload')?.click()}>
                    <input 
                        type="file" 
                        id="avatar-upload" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleAvatarUpload} 
                    />
                    {user?.photoURL ? (
                        <img
                            src={user.photoURL}
                            alt="Avatar"
                            className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-700 transition-opacity group-hover:opacity-70"
                        />
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center border-2 border-slate-700 transition-opacity group-hover:opacity-70">
                            <span className="text-2xl font-bold text-white">{getInitials()}</span>
                        </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <Camera className="text-white drop-shadow-md" size={24} />
                    </div>
                </div>
                <div>
                    <p className="text-sm font-medium text-white">{displayName || t('settings.profile.noName')}</p>
                    <p className="text-xs text-slate-500">{user?.email || t('settings.profile.noEmail')}</p>
                    <p className="text-xs text-slate-600 mt-1">
                        UID: {user?.uid?.substring(0, 8)}...
                    </p>
                </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1.5">{t('settings.profile.displayName')}</label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => { setDisplayName(e.target.value); setDirty(true); }}
                        className={`w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:${getColorForModule('settings').border} transition-all`}
                        placeholder={t('settings.hints.display_name')}
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1.5">{t('settings.profile.bio')}</label>
                    <textarea
                        value={bio}
                        onChange={(e) => { setBio(e.target.value); setDirty(true); }}
                        rows={3}
                        className={`w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:${getColorForModule('settings').border} transition-all resize-none`}
                        placeholder={t('settings.hints.bio_desc')}
                    />
                    <p className="text-xs text-slate-600 mt-1">{t('settings.profile.characters', { count: bio.length })}</p>
                </div>

                <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1.5">{t('settings.profile.email')}</label>
                    <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-600 mt-1">{t('settings.profile.emailCannotChange')}</p>
                </div>

                {dirty && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`flex items-center gap-2 ${getColorForModule('settings').bg.replace('/10', '')} hover:opacity-90 text-black px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50`}
                        >
                            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                            {saving ? t('settings.profile.saving') : t('settings.profile.saveChanges')}
                        </button>
                        <button
                            onClick={() => {
                                setDisplayName(user?.displayName || '');
                                setBio(userProfile?.bio || '');
                                setDirty(false);
                            }}
                            className="flex items-center gap-2 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors"
                        >
                            <X size={14} /> {t('settings.profile.cancel')}
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
