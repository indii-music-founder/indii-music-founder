import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState } from 'react';
import { X, ChevronRight, ChevronLeft, Wand2, Loader2, Copy, CheckCircle, ExternalLink, Image as ImageIcon, Download, Link } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { SOCIAL_TOOLS } from '../tools';
import BrandAssetsDrawer from '../../creative/components/BrandAssetsDrawer';
import { ImageAsset } from '../types';
import { logger } from '@/utils/logger';
import { useStore } from '@/core/store';
import { createPortal } from 'react-dom';

interface AccountCreationWizardProps {
    onClose: () => void;
}

const PLATFORMS = [
    { name: 'Twitter', url: 'https://twitter.com/i/flow/signup', color: 'bg-sky-500' },
    { name: 'Instagram', url: 'https://www.instagram.com/accounts/emailsignup/', color: 'bg-pink-600' },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/signup', color: 'bg-blue-700' },
    { name: 'TikTok', url: 'https://www.tiktok.com/signup', color: 'bg-black' },
];

interface AccountSetupDraft {
    step: number;
    platformName: string;
    brandName: string;
    industry: string;
    generatedIdentity: { handles: string[]; bios: string[] } | null;
    profileImage: ImageAsset | null;
    bannerImage: ImageAsset | null;
    transferredAssetUrls: string[];
}

const draftStorageKey = (userId: string, projectId: string) => `indii:social-account-setup:${userId}:${projectId}`;

const readDraft = (userId: string, projectId: string): AccountSetupDraft | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(draftStorageKey(userId, projectId));
        if (!raw) return null;
        const draft = JSON.parse(raw) as AccountSetupDraft;
        return typeof draft.platformName === 'string' ? draft : null;
    } catch {
        return null;
    }
};

const canTransferAsset = (asset: ImageAsset | null) => Boolean(asset?.imageUrl && /^(https?:|blob:|data:image\/)/i.test(asset.imageUrl));

export default function AccountCreationWizard({ onClose }: AccountCreationWizardProps) {
    const { t } = useTranslation();
    const toast = useToast();
    const draftScope = useMemo(() => {
        const state = useStore.getState();
        return { userId: state.userProfile?.id || 'anonymous', projectId: state.currentProjectId || 'default' };
    }, []);
    const restoredDraft = useMemo(() => readDraft(draftScope.userId, draftScope.projectId), [draftScope]);
    const [step, setStep] = useState(restoredDraft?.step || 1);
    const [platform, setPlatform] = useState(() => PLATFORMS.find(({ name }) => name === restoredDraft?.platformName) || PLATFORMS[0]!);
    const [brandName, setBrandName] = useState(restoredDraft?.brandName || '');
    const [industry, setIndustry] = useState(restoredDraft?.industry || '');

    const [generatedIdentity, setGeneratedIdentity] = useState<{ handles: string[], bios: string[] } | null>(restoredDraft?.generatedIdentity || null);
    const [isGenerating, setIsGenerating] = useState(false);

    const [profileImage, setProfileImage] = useState<ImageAsset | null>(restoredDraft?.profileImage || null);
    const [bannerImage, setBannerImage] = useState<ImageAsset | null>(restoredDraft?.bannerImage || null);
    const [transferredAssetUrls, setTransferredAssetUrls] = useState<string[]>(restoredDraft?.transferredAssetUrls || []);
    const [selectingFor, setSelectingFor] = useState<'profile' | 'banner' | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const draft: AccountSetupDraft = { step, platformName: platform.name, brandName, industry, generatedIdentity, profileImage, bannerImage, transferredAssetUrls };
        window.localStorage.setItem(draftStorageKey(draftScope.userId, draftScope.projectId), JSON.stringify(draft));
    }, [brandName, bannerImage, draftScope, generatedIdentity, industry, platform.name, profileImage, step, transferredAssetUrls]);

    const handleGenerateIdentity = async () => {
        if (!brandName || !industry) {
            toast.error("Please enter Brand Name and Industry");
            return;
        }
        setIsGenerating(true);
        try {
            const identity = await SOCIAL_TOOLS.generate_social_identity({
                brand_name: brandName,
                platform: platform.name,
                industry: industry
            });

            setGeneratedIdentity(identity);
            toast.success("Identity ideas generated!");
        } catch (error: unknown) {
            logger.error("Operation failed:", error);
            toast.error("Failed to generate identity ideas. Please try again.");
            setGeneratedIdentity(null);
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = async (text: string): Promise<boolean> => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success("Copied to clipboard");
            return true;
        } catch {
            toast.error('Clipboard access was unavailable.');
            return false;
        }
    };

    const markTransferred = (asset: ImageAsset) => setTransferredAssetUrls(urls => urls.includes(asset.imageUrl) ? urls : [...urls, asset.imageUrl]);

    const downloadAsset = async (asset: ImageAsset) => {
        if (!canTransferAsset(asset)) return toast.error('This asset is unavailable. Choose it again before continuing.');
        const { downloadAsset: download } = await import('@/utils/download');
        if (await download(asset.imageUrl, `${asset.title || 'social-asset'}.png`)) markTransferred(asset);
        else toast.error('Could not download this asset. Choose it again or use Open.');
    };

    const renderStep1_Platform = () => (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-white">1. Choose Platform</h3>
            <div className="grid grid-cols-2 gap-4">
                {PLATFORMS.map((p) => (
                    <button
                        key={p.name}
                        onClick={() => setPlatform(p)}
                        className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${platform.name === p.name
                            ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500'
                            : 'bg-bg-dark border-gray-800 hover:border-gray-600'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-full ${p.color} flex items-center justify-center text-white font-bold text-xs`}>
                            {p.name[0]}
                        </div>
                        <span className="font-medium text-gray-200">{p.name}</span>
                    </button>
                ))}
            </div>
            <div className="space-y-4 mt-6">
                <div>
                    <label htmlFor="acw-brand-name" className="block text-sm text-gray-400 mb-1">Brand Name</label>
                    <input
                        id="acw-brand-name"
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                        placeholder={t('social.hints.company_example')}
                    />
                </div>
                <div>
                    <label htmlFor="acw-industry" className="block text-sm text-gray-400 mb-1">Industry</label>
                    <input
                        id="acw-industry"
                        type="text"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                        placeholder={t('social.hints.industry_example')}
                    />
                </div>
            </div>
        </div>
    );

    const renderStep2_Identity = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">2. Generate Identity</h3>
                <button
                    onClick={handleGenerateIdentity}
                    disabled={isGenerating}
                    className="text-sm flex items-center gap-2 text-green-400 hover:text-green-300 disabled:opacity-50"
                >
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {generatedIdentity ? 'Regenerate' : 'Generate Ideas'}
                </button>
            </div>

            {!generatedIdentity ? (
                <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl">
                    <Wand2 size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Click generate to get Autonomous handle and bio ideas.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Suggested Handles</label>
                        <div className="space-y-2">
                            {generatedIdentity.handles.map((handle, i) => (
                                <div key={i} className="flex items-center justify-between bg-bg-dark p-3 rounded-lg border border-gray-800 group hover:border-gray-600 transition-colors">
                                    <span className="font-mono text-blue-400">{handle}</span>
                                    <button onClick={() => copyToClipboard(handle)} className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Copy size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Suggested Bios</label>
                        <div className="space-y-2">
                            {generatedIdentity.bios.map((bio, i) => (
                                <div key={i} className="flex items-start justify-between bg-bg-dark p-3 rounded-lg border border-gray-800 group hover:border-gray-600 transition-colors">
                                    <p className="text-sm text-gray-300">{bio}</p>
                                    <button onClick={() => copyToClipboard(bio)} className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                                        <Copy size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderStep3_Assets = () => (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-white">3. Select Assets</h3>

            <div className="grid grid-cols-1 gap-6">
                {/* Profile Picture */}
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Profile Picture</label>
                    {profileImage ? (
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gray-700 group">
                            <img src={profileImage.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                            <button
                                onClick={() => setProfileImage(null)}
                                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setSelectingFor('profile')}
                            className="w-24 h-24 rounded-full border-2 border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-500 hover:border-gray-500 hover:bg-gray-800/50 transition-all"
                        >
                            <ImageIcon size={20} />
                            <span className="text-[10px] mt-1">Select</span>
                        </button>
                    )}
                </div>

                {/* Banner */}
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Banner / Cover Image</label>
                    {bannerImage ? (
                        <div className="relative w-full h-32 rounded-lg overflow-hidden border-2 border-gray-700 group">
                            <img src={bannerImage.imageUrl} alt="Banner" className="w-full h-full object-cover" />
                            <button
                                onClick={() => setBannerImage(null)}
                                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setSelectingFor('banner')}
                            className="w-full h-32 rounded-lg border-2 border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-500 hover:border-gray-500 hover:bg-gray-800/50 transition-all"
                        >
                            <ImageIcon size={24} />
                            <span className="text-sm mt-2">Select Banner Image</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    const renderStep4_Finish = () => (
        <div className="space-y-8 text-center py-8">
            {(() => {
                const selectedAssets = [profileImage, bannerImage].filter((asset): asset is ImageAsset => asset !== null);
                const assetsReady = selectedAssets.every(asset => canTransferAsset(asset) && transferredAssetUrls.includes(asset.imageUrl));
                return <>
            <div className={`w-16 h-16 ${assetsReady ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-400'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                <CheckCircle size={32} />
            </div>
            <div>
                <h3 className="text-2xl font-bold text-white mb-2">{assetsReady ? 'Ready to Create!' : 'Finish asset handoff'}</h3>
                <p className="text-gray-400 max-w-md mx-auto">
                    {assetsReady ? `Your setup draft is saved for this project. Continue to ${platform.name} sign-up with your transferred assets.` : `Your setup draft is saved for this project. Transfer each selected asset below before continuing to ${platform.name} sign-up.`}
                </p>
            </div>

            <a
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-xl shadow-blue-900/20"
            >
                Go to {platform.name} Sign Up <ExternalLink size={20} />
            </a>

            <div className="bg-bg-dark p-4 rounded-xl border border-gray-800 text-left max-w-sm mx-auto">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Copy</h4>
                {generatedIdentity && generatedIdentity.handles[0] && (
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-300 text-sm">Handle</span>
                        <button onClick={() => copyToClipboard(generatedIdentity.handles[0]!)} className="text-blue-400 text-xs hover:underline">Copy Top Pick</button>
                    </div>
                )}
                {generatedIdentity && generatedIdentity.bios[0] && (
                    <div className="flex justify-between items-center">
                        <span className="text-gray-300 text-sm">Bio</span>
                        <button onClick={() => copyToClipboard(generatedIdentity.bios[0]!)} className="text-blue-400 text-xs hover:underline">Copy Top Pick</button>
                    </div>
                )}
            </div>

            {(profileImage || bannerImage) && (
                <div className="bg-bg-dark p-4 rounded-xl border border-gray-800 text-left max-w-md mx-auto space-y-3">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Asset handoff</h4>
                    {([['Profile image', profileImage, 'Use a square image; Instagram recommends at least 320 × 320 px.'], ['Banner / cover', bannerImage, 'Use the platform crop preview; keep text away from outer edges.']] as const).map(([label, asset, guidance]) => asset && (
                        <div key={label} className="border border-gray-700 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-3"><img src={asset.imageUrl} alt={label} className="h-10 w-10 object-cover rounded" /><div><p className="text-sm text-white">{label}</p><p className="text-xs text-gray-500">{guidance}</p></div></div>
                            {!canTransferAsset(asset) ? <p className="text-xs text-red-400">Unavailable — return to step 3 and choose this asset again.</p> : <div className="flex gap-3 text-xs"><button onClick={() => void downloadAsset(asset)} className="text-blue-400 hover:underline inline-flex items-center gap-1"><Download size={12} />Download</button><button onClick={() => { if (window.open(asset.imageUrl, '_blank', 'noopener,noreferrer')) markTransferred(asset); else toast.error('Pop-up blocked. Download or copy the link instead.'); }} className="text-blue-400 hover:underline inline-flex items-center gap-1"><ExternalLink size={12} />Open</button><button onClick={() => { void copyToClipboard(asset.imageUrl).then(copied => { if (copied) markTransferred(asset); }).catch(() => { toast.error('Failed to copy link to clipboard.'); }); }} className="text-blue-400 hover:underline inline-flex items-center gap-1"><Link size={12} />Copy link</button></div>}
                            {canTransferAsset(asset) && !transferredAssetUrls.includes(asset.imageUrl) && <p className="text-xs text-amber-400">Choose Download, Open, or Copy link to mark this asset ready for transfer.</p>}
                        </div>
                    ))}
                </div>
            )}
            </>;
            })()}
        </div>
    );

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div role="dialog" aria-modal="true" aria-label="Add social account" className="bg-[#161b22] border border-gray-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col h-[90dvh] md:h-[600px] max-h-[600px]">
                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-bg-dark">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className={`w-2 h-2 rounded-full ${i === step ? 'bg-blue-500' : i < step ? 'bg-blue-900' : 'bg-gray-800'}`} />
                            ))}
                        </div>
                        <span className="text-sm text-gray-400 ml-2">Step {step} of 4</span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto flex-1">
                    {step === 1 && renderStep1_Platform()}
                    {step === 2 && renderStep2_Identity()}
                    {step === 3 && renderStep3_Assets()}
                    {step === 4 && renderStep4_Finish()}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-bg-dark flex justify-between">
                    <button
                        onClick={() => setStep(s => Math.max(1, s - 1))}
                        disabled={step === 1}
                        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                        <ChevronLeft size={16} /> Back
                    </button>

                    {step < 4 ? (
                        <button
                            onClick={() => setStep(s => Math.min(4, s + 1))}
                            className="px-6 py-2 bg-white text-black hover:bg-gray-200 text-sm font-bold rounded-lg transition-colors flex items-center gap-1"
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg transition-colors"
                        >
                            Done
                        </button>
                    )}
                </div>
            </div>

            {/* Asset Drawer */}
            {!!selectingFor && (
                <BrandAssetsDrawer
                    onClose={() => setSelectingFor(null)}
                    onSelect={(asset) => {
                        const imageAsset: ImageAsset = {
                            assetType: 'image',
                            title: asset.description || 'Untitled',
                            imageUrl: asset.url,
                            caption: ''
                        };
                        if (selectingFor === 'profile') setProfileImage(imageAsset);
                        if (selectingFor === 'banner') setBannerImage(imageAsset);
                        setSelectingFor(null);
                    }}
                />
            )}
        </div>,
        document.body
    );
}
