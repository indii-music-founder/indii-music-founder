import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Wand2, Loader2, Copy, CheckCircle, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { SOCIAL_TOOLS } from '../tools';
import BrandAssetsDrawer from '../../creative/components/BrandAssetsDrawer';
import { ImageAsset } from '../types';

interface AccountCreationWizardProps {
    onClose: () => void;
}

const PLATFORMS = [
    { name: 'Twitter', url: 'https://twitter.com/i/flow/signup', color: 'bg-sky-500' },
    { name: 'Instagram', url: 'https://www.instagram.com/accounts/emailsignup/', color: 'bg-pink-600' },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/signup', color: 'bg-blue-700' },
    { name: 'TikTok', url: 'https://www.tiktok.com/signup', color: 'bg-black' },
];

export default function AccountCreationWizard({ onClose }: AccountCreationWizardProps) {
    const toast = useToast();
    const [step, setStep] = useState(1);
    const [platform, setPlatform] = useState(PLATFORMS[0]);
    const [brandName, setBrandName] = useState('');
    const [industry, setIndustry] = useState('');

    const [generatedIdentity, setGeneratedIdentity] = useState<{ handles: string[], bios: string[] } | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const [profileImage, setProfileImage] = useState<ImageAsset | null>(null);
    const [bannerImage, setBannerImage] = useState<ImageAsset | null>(null);
    const [selectingFor, setSelectingFor] = useState<'profile' | 'banner' | null>(null);

    const handleGenerateIdentity = async () => {
        if (!brandName || !industry) {
            toast.error("Please enter Brand Name and Industry");
            return;
        }
        setIsGenerating(true);
        try {
            const resultStr = await SOCIAL_TOOLS.generate_social_identity({
                brand_name: brandName,
                platform: platform.name,
                industry: industry
            });

            // Basic cleaning of markdown code blocks if present
            const cleanJson = resultStr.replace(/```json/g, '').replace(/```/g, '').trim();
            let result;
            try {
                result = JSON.parse(cleanJson);
            } catch (e) {
                console.error("Failed to parse identity JSON", e);
                throw new Error("Invalid response format");
            }

            setGeneratedIdentity(result);
            toast.success("Identity ideas generated!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate identity ideas");
            // Fallback mock for demo/error case
            setGeneratedIdentity({
                handles: [`@${brandName.replace(/\s+/g, '')}_official`, `@${brandName.replace(/\s+/g, '')}HQ`, `@Try${brandName.replace(/\s+/g, '')}`],
                bios: [`Official account of ${brandName}. Innovating in ${industry}.`, `Welcome to ${brandName}. Follow for updates!`, `Leading the way in ${industry}.`]
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
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
                    <label className="block text-sm text-gray-400 mb-1">Brand Name</label>
                    <input
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                        placeholder="e.g. Acme Corp"
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Industry</label>
                    <input
                        type="text"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                        placeholder="e.g. Technology"
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
                    className="text-sm flex items-center gap-2 text-purple-400 hover:text-purple-300 disabled:opacity-50"
                >
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {generatedIdentity ? 'Regenerate' : 'Generate Ideas'}
                </button>
            </div>

            {!generatedIdentity ? (
                <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl">
                    <Wand2 size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Click generate to get AI-powered handle and bio ideas.</p>
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
            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} />
            </div>
            <div>
                <h3 className="text-2xl font-bold text-white mb-2">Ready to Create!</h3>
                <p className="text-gray-400 max-w-md mx-auto">
                    You have everything you need. Click the link below to go to {platform.name}'s sign-up page. Use the handles and bios you generated.
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
                        <button onClick={() => copyToClipboard(generatedIdentity.handles[0])} className="text-blue-400 text-xs hover:underline">Copy Top Pick</button>
                    </div>
                )}
                {generatedIdentity && generatedIdentity.bios[0] && (
                    <div className="flex justify-between items-center">
                        <span className="text-gray-300 text-sm">Bio</span>
                        <button onClick={() => copyToClipboard(generatedIdentity.bios[0])} className="text-blue-400 text-xs hover:underline">Copy Top Pick</button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#161b22] border border-gray-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col h-[600px]">
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
                            title: asset.name || 'Untitled',
                            imageUrl: asset.url,
                            caption: ''
                        };
                        if (selectingFor === 'profile') setProfileImage(imageAsset);
                        if (selectingFor === 'banner') setBannerImage(imageAsset);
                        setSelectingFor(null);
                    }}
                />
            )}
        </div>
    );
}
