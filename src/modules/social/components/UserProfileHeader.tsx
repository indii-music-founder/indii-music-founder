import React, { useEffect, useState } from 'react';
import { UserProfile } from '@/types/User';
import { UserService } from '@/services/UserService';
import { SocialService } from '@/services/social/SocialService';
import { useStore } from '@/core/store';
import { Users, UserPlus, UserCheck, Edit, MapPin, Link as LinkIcon } from 'lucide-react';

interface UserProfileHeaderProps {
    userId?: string;
}

export default function UserProfileHeader({ userId }: UserProfileHeaderProps) {
    const currentUser = useStore((state) => state.userProfile);
    const targetId = userId || currentUser?.id;

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState(false);

    useEffect(() => {
        if (!targetId) return;
        loadProfile();
        checkFollowStatus();
    }, [targetId]);

    const loadProfile = async () => {
        if (!targetId) return;
        setLoading(true);
        try {
            const data = await UserService.getUserProfile(targetId);
            setProfile(data);
        } catch (error) {
            console.error("Failed to load profile", error);
        } finally {
            setLoading(false);
        }
    };

    const checkFollowStatus = async () => {
        if (targetId && currentUser && targetId !== currentUser.id) {
            const status = await SocialService.isFollowing(targetId);
            setIsFollowing(status);
        }
    };

    const handleFollowToggle = async () => {
        if (!targetId || followLoading) return;
        setFollowLoading(true);
        try {
            if (isFollowing) {
                await SocialService.unfollowUser(targetId);
                setIsFollowing(false);
                // Optimistic update of stats
                if (profile && profile.socialStats) {
                    setProfile({
                        ...profile,
                        socialStats: {
                            ...profile.socialStats,
                            followers: Math.max(0, profile.socialStats.followers - 1)
                        }
                    });
                }
            } else {
                await SocialService.followUser(targetId);
                setIsFollowing(true);
                // Optimistic update of stats
                if (profile) {
                    setProfile({
                        ...profile,
                        socialStats: {
                            ...(profile.socialStats || { followers: 0, following: 0, posts: 0, drops: 0 }),
                            followers: (profile.socialStats?.followers || 0) + 1
                        }
                    });
                }
            }
        } catch (error) {
            console.error("Failed to toggle follow", error);
        } finally {
            setFollowLoading(false);
        }
    };

    if (loading) {
        return <div className="h-64 bg-gray-900 animate-pulse rounded-b-xl" />;
    }

    if (!profile) {
        return <div className="p-8 text-center text-gray-500">User not found</div>;
    }

    const { displayName, bio, photoURL, brandKit, socialStats, accountType } = profile;
    const bannerUrl = brandKit?.brandAssets?.find(a => a.category === 'environment' || a.category === 'other')?.url || brandKit?.brandAssets?.[0]?.url;
    const isOwnProfile = currentUser?.id === targetId;

    return (
        <div className="relative bg-bg-dark border-b border-gray-800">
            {/* Banner */}
            <div className="h-48 w-full overflow-hidden bg-gradient-to-r from-purple-900 to-blue-900">
                {bannerUrl && (
                    <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover opacity-60" />
                )}
            </div>

            <div className="max-w-7xl mx-auto px-6 pb-6">
                <div className="flex flex-col md:flex-row items-end -mt-16 gap-6">
                    {/* Avatar */}
                    <div className="relative">
                        <div className="w-32 h-32 rounded-full border-4 border-[#0d1117] bg-gray-800 overflow-hidden shadow-xl">
                            {photoURL ? (
                                <img src={photoURL} alt={displayName || 'User'} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-3xl font-bold text-white">
                                    {displayName?.[0] || 'U'}
                                </div>
                            )}
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-full text-xs font-bold text-white border border-white/20 uppercase">
                            {accountType || 'Fan'}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 mb-2">
                        <h1 className="text-3xl font-bold text-white truncate">{displayName}</h1>
                        <p className="text-gray-400 mt-1 max-w-2xl text-sm leading-relaxed">
                            {bio || "No bio yet."}
                        </p>

                        {/* Meta Row */}
                        <div className="flex items-center gap-6 mt-4 text-sm text-gray-300">
                            <div className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
                                <Users size={16} className="text-gray-500" />
                                <span className="font-bold text-white">{socialStats?.followers || 0}</span> Followers
                            </div>
                            <div className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
                                <span className="font-bold text-white">{socialStats?.following || 0}</span> Following
                            </div>
                            <div className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
                                <span className="font-bold text-white">{socialStats?.drops || 0}</span> Drops
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 mb-2">
                        {isOwnProfile ? (
                            <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 border border-gray-700 transition-colors">
                                <Edit size={16} />
                                Edit Profile
                            </button>
                        ) : (
                            <button
                                onClick={handleFollowToggle}
                                disabled={followLoading}
                                className={`px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all shadow-lg ${isFollowing
                                    ? 'bg-gray-800 hover:bg-red-900/40 text-gray-300 hover:text-red-400 border border-gray-700 hover:border-red-800'
                                    : 'bg-white hover:bg-gray-100 text-black'
                                    }`}
                            >
                                {isFollowing ? (
                                    <>
                                        <UserCheck size={18} /> Following
                                    </>
                                ) : (
                                    <>
                                        <UserPlus size={18} /> Follow
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
