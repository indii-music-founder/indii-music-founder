import React from 'react';
import { motion } from 'motion/react';
import { CreditCard, Rocket, Shield, CheckCircle2, AlertCircle, ExternalLink, Zap, Package, RefreshCw } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionTier, getTierConfig, getTierOrder } from '@/services/subscription/SubscriptionTier';
import { Progress } from '@/components/ui/progress';

export const SubscriptionTab = () => {
    const { subscription, usage, loading, error, createCheckoutSession, getPortalUrl, refresh } = useSubscription();

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-12 h-12 rounded-full border-t-2 border-dept-royalties animate-spin" />
                <p className="text-gray-400 font-medium">Loading subscription profile...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-6 bg-red-500/5 rounded-3xl border border-red-500/20">
                <AlertCircle size={40} className="text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Sync Error</h3>
                <p className="text-gray-400 text-center mb-6 max-w-sm">{error}</p>
                <button
                    onClick={() => refresh()}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white font-bold transition-all"
                >
                    Try Again
                </button>
            </div>
        );
    }

    const currentTier = subscription?.tier || SubscriptionTier.FREE;
    const currentTierConfig = getTierConfig(currentTier);

    return (
        <div className="space-y-8 pb-20">
            {/* Active Subscription Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="lg:col-span-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 relative overflow-hidden group shadow-2xl"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Zap size={120} className="text-dept-royalties" />
                    </div>

                    <div className="relative z-10">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${currentTier === SubscriptionTier.FREE ? 'bg-gray-800 text-gray-400' : 'bg-dept-royalties/20 text-dept-royalties border border-dept-royalties/30'
                            }`}>
                            {currentTierConfig.name}
                        </span>
                        <h2 className="text-4xl font-black text-white mt-4 mb-2 tracking-tight">Active</h2>
                        <div className="space-y-1 mb-6">
                            <p className="text-sm text-gray-500">Subscription Status</p>
                            {subscription?.cancelAtPeriodEnd && (
                                <p className="text-xs text-red-400 flex items-center gap-1">
                                    <AlertCircle size={12} />
                                    Ends on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                                </p>
                            )}
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={() => getPortalUrl()}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                            >
                                <CreditCard size={14} />
                                Manage Billing
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Quota Progress */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="lg:col-span-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <RefreshCw size={16} className="text-dept-creative" />
                            Resource Allowance
                        </h3>
                        <span className="text-xs text-gray-500">Resets monthly</span>
                    </div>

                    {!usage ? (
                        <div className="h-40 flex items-center justify-center text-gray-600 italic">
                            Loading usage metrics...
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Images */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-400 font-medium tracking-tight uppercase">AI Images</span>
                                    <span className="text-white font-mono">{usage.imagesGenerated} / {usage.imagesPerMonth}</span>
                                </div>
                                <Progress value={(usage.imagesGenerated / usage.imagesPerMonth) * 100} className="h-2 bg-white/5" indicatorClassName="bg-dept-creative" />
                                <p className="text-[10px] text-gray-500">Monthly image synthesis limit</p>
                            </div>

                            {/* Video */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-400 font-medium tracking-tight uppercase">AI Video</span>
                                    <span className="text-white font-mono">{usage.videoDurationMinutes.toFixed(1)} / {usage.videoTotalMinutes}m</span>
                                </div>
                                <Progress value={(usage.videoDurationMinutes / usage.videoTotalMinutes) * 100} className="h-2 bg-white/5" indicatorClassName="bg-dept-royalties" />
                                <p className="text-[10px] text-gray-500">AI video generation compute</p>
                            </div>

                            {/* Tokens */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-400 font-medium tracking-tight uppercase">Intelligence</span>
                                    <span className="text-white font-mono">{(usage.aiChatTokensUsed / 1000).toFixed(1)}k / {(usage.aiChatTokensPerMonth / 1000).toFixed(1)}k</span>
                                </div>
                                <Progress value={(usage.aiChatTokensUsed / usage.aiChatTokensPerMonth) * 100} className="h-2 bg-white/5" indicatorClassName="bg-dept-marketing" />
                                <p className="text-[10px] text-gray-500">AI intelligence token quota</p>
                            </div>

                            {/* Storage */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-400 font-medium tracking-tight uppercase">Secure Storage</span>
                                    <span className="text-white font-mono">{usage.storageUsedGB.toFixed(2)} / {usage.storageTotalGB}GB</span>
                                </div>
                                <Progress value={(usage.storageUsedGB / usage.storageTotalGB) * 100} className="h-2 bg-white/5" indicatorClassName="bg-dept-distribution" />
                                <p className="text-[10px] text-gray-500">Encrypted workspace storage</p>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Plan Comparison Integration */}
            <h3 className="text-2xl font-black text-white mt-12 mb-6 ml-1 tracking-tight">Available Systems</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {getTierOrder().map((tierId, index) => {
                    const config = getTierConfig(tierId);
                    const isCurrent = tierId === currentTier;
                    const isStudio = tierId === SubscriptionTier.STUDIO;

                    return (
                        <motion.div
                            key={tierId}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`
                group relative bg-black/40 backdrop-blur-2xl border rounded-3xl p-8 flex flex-col transition-all duration-500
                ${isCurrent ? 'border-dept-royalties shadow-[0_0_40px_rgba(255,215,0,0.1)] scale-[1.02]' : 'border-white/10 hover:border-white/20'}
              `}
                        >
                            {isCurrent && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-dept-royalties text-black text-[10px] font-black uppercase rounded-full tracking-widest shadow-lg">
                                    Current System
                                </div>
                            )}

                            <div className="mb-8">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${isStudio ? 'bg-dept-creative/20 text-dept-creative border border-dept-creative/30' : 'bg-white/5 text-gray-400'
                                    }`}>
                                    {isStudio ? <Rocket size={24} /> : (tierId === SubscriptionTier.FREE ? <Package size={24} /> : <Shield size={24} />)}
                                </div>
                                <h4 className="text-2xl font-black text-white mb-2">{config.name}</h4>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-white">${config.price}</span>
                                    <span className="text-gray-500 text-sm font-medium">/{config.billingPeriod}</span>
                                </div>
                                <p className="text-sm text-gray-400 mt-4 leading-relaxed line-clamp-2">{config.description}</p>
                            </div>

                            <div className="space-y-4 mb-10 flex-1">
                                <div className="flex items-center gap-3 group/item">
                                    <CheckCircle2 size={16} className="text-dept-royalties flex-shrink-0" />
                                    <span className="text-sm text-gray-300 font-medium group-hover/item:text-white transition-colors">{config.imageGenerations.monthly} Monthly Images</span>
                                </div>
                                <div className="flex items-center gap-3 group/item">
                                    <CheckCircle2 size={16} className="text-dept-royalties flex-shrink-0" />
                                    <span className="text-sm text-gray-300 font-medium group-hover/item:text-white transition-colors">{config.videoGenerations.totalDurationMinutes}m Video Credit</span>
                                </div>
                                <div className="flex items-center gap-3 group/item">
                                    <CheckCircle2 size={16} className="text-dept-royalties flex-shrink-0" />
                                    <span className="text-sm text-gray-300 font-medium group-hover/item:text-white transition-colors">{config.storage.totalGB}GB Workspace Storage</span>
                                </div>
                                <div className="flex items-center gap-3 group/item">
                                    <CheckCircle2 size={16} className="text-dept-royalties flex-shrink-0" />
                                    <span className="text-sm text-gray-300 font-medium group-hover/item:text-white transition-colors">{config.maxProjects} Active Projects</span>
                                </div>
                            </div>

                            <button
                                disabled={isCurrent || loading}
                                onClick={() => createCheckoutSession(tierId)}
                                className={`
                  w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all
                  flex items-center justify-center gap-2
                  ${isCurrent
                                        ? 'bg-transparent border border-white/20 text-gray-500 cursor-not-allowed'
                                        : isStudio
                                            ? 'bg-dept-royalties text-black hover:opacity-90 shadow-[0_10px_30px_rgba(255,215,0,0.15)] active:scale-95'
                                            : 'bg-white/10 text-white hover:bg-white/20 active:scale-95'
                                    }
                `}
                            >
                                {isCurrent ? 'Current' : (tierId === SubscriptionTier.FREE ? 'Switch to Basic' : 'Initialize Upgrade')}
                                {!isCurrent && <ExternalLink size={14} />}
                            </button>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};
