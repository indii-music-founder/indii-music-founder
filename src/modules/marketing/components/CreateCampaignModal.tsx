import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Plus, Loader2, AlertCircle } from 'lucide-react';
import { MarketingService } from '@/services/marketing/MarketingService';
import { CampaignStatus } from '../types';
import { useToast } from '@/core/context/ToastContext';
import { cn } from '@/lib/utils';

interface Props {
    onClose: () => void;
    onSave: (campaignId?: string) => void;
}

export default function CreateCampaignModal({ onClose, onSave }: Props) {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');
    const [platform, setPlatform] = useState('Instagram');
    const [errors, setErrors] = useState<Record<string, string>>({});



    // Refs for focus management
    const titleRef = useRef<HTMLInputElement>(null);
    const startDateRef = useRef<HTMLInputElement>(null);

    // UX: Close on Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Close on backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        let isValid = true;

        if (!title.trim()) {
            newErrors.title = 'Campaign name is required';
            isValid = false;
        }

        if (!startDate) {
            newErrors.startDate = 'Start date is required';
            isValid = false;
        }

        setErrors(newErrors);

        // Focus first invalid field
        if (!isValid) {
            if (newErrors.title) {
                titleRef.current?.focus();
            } else if (newErrors.startDate) {
                startDateRef.current?.focus();
            }
        }

        return isValid;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            return;
        }

        setIsLoading(true);
        try {
            const id = await MarketingService.createCampaign({
                assetType: 'campaign',
                title,
                description,
                startDate,
                endDate,
                durationDays: 30, // Default for now
                status: CampaignStatus.PENDING,
                posts: []
            });
            toast.success('Campaign created successfully!');
            onSave(id);
            onClose();
        } catch (error) {
            // console.error(error);
            toast.error('Failed to create campaign');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            data-testid="create-campaign-modal-backdrop"
        >
            <div className="bg-[#161b22] border border-gray-800 rounded-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 shadow-2xl">
                <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                    <h2 id="modal-title" className="text-xl font-bold flex items-center gap-2 text-white">
                        <Plus className="text-blue-500" />
                        New Campaign
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded-md p-1"
                        aria-label="Close modal"
                        data-testid="close-modal-btn"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-4" noValidate>
                    <div>
                        <label htmlFor="campaign-title" className="block text-sm font-medium text-gray-400 mb-1">
                            Campaign Name <span className="text-red-500" aria-hidden="true">*</span>
                        </label>
                        <input
                            ref={titleRef}
                            id="campaign-title"
                            type="text"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
                            }}
                            placeholder="e.g., Summer Single Release"
                            className={cn(
                                "w-full bg-[#0d1117] border rounded-lg p-2.5 text-white outline-none transition-all",
                                errors.title
                                    ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                                    : "border-gray-700 focus:border-blue-500"
                            )}
                            required
                            autoFocus
                            aria-invalid={!!errors.title}
                            aria-describedby={errors.title ? "title-error" : undefined}
                            data-testid="campaign-title-input"
                        />
                        {errors.title && (
                            <p id="title-error" className="mt-1 text-xs text-red-500 flex items-center gap-1 animate-in slide-in-from-left-1 duration-200">
                                <AlertCircle size={12} /> {errors.title}
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="campaign-description" className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                        <textarea
                            id="campaign-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief overview of the campaign..."
                            className="w-full h-24 bg-[#0d1117] border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none resize-none"
                            data-testid="campaign-description-input"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="campaign-start-date" className="block text-sm font-medium text-gray-400 mb-1">
                                Start Date <span className="text-red-500" aria-hidden="true">*</span>
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 text-gray-500 pointer-events-none" size={16} />
                                <input
                                    ref={startDateRef}
                                    id="campaign-start-date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        if (errors.startDate) setErrors(prev => ({ ...prev, startDate: '' }));
                                    }}
                                    className={cn(
                                        "w-full bg-[#0d1117] border rounded-lg p-2.5 pl-10 text-white outline-none transition-all",
                                        errors.startDate
                                            ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                                            : "border-gray-700 focus:border-blue-500"
                                    )}
                                    required
                                    aria-invalid={!!errors.startDate}
                                    aria-describedby={errors.startDate ? "start-date-error" : undefined}
                                    data-testid="campaign-start-date-input"
                                />
                            </div>
                            {errors.startDate && (
                                <p id="start-date-error" className="mt-1 text-xs text-red-500 flex items-center gap-1 animate-in slide-in-from-left-1 duration-200">
                                    <AlertCircle size={12} /> {errors.startDate}
                                </p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="campaign-end-date" className="block text-sm font-medium text-gray-400 mb-1">End Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 text-gray-500 pointer-events-none" size={16} />
                                <input
                                    id="campaign-end-date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2.5 pl-10 text-white focus:border-blue-500 outline-none"
                                    data-testid="campaign-end-date-input"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="campaign-platform" className="block text-sm font-medium text-gray-400 mb-1">Platform</label>
                        <div className="relative">
                            <select
                                id="campaign-platform"
                                value={platform}
                                onChange={(e) => setPlatform(e.target.value)}
                                className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none appearance-none cursor-pointer"
                                data-testid="campaign-platform-select"
                            >
                                <option>Instagram</option>
                                <option>Twitter</option>
                                <option>TikTok</option>
                                <option>LinkedIn</option>
                                <option>Multi-platform</option>
                            </select>
                            <div className="absolute right-3 top-3 pointer-events-none text-gray-500">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors border border-gray-700 focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:outline-none"
                            data-testid="cancel-campaign-btn"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
                            data-testid="create-campaign-submit-btn"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} data-testid="loading-spinner" />
                                    <span>Creating...</span>
                                </>
                            ) : (
                                'Launch Campaign'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
