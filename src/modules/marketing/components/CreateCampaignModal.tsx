import React, { useState } from 'react';
import { X, Calendar, Target, Image as ImageIcon, Plus } from 'lucide-react';
import { MarketingService } from '@/services/marketing/MarketingService';
import { CampaignStatus } from '../types';
import { useToast } from '@/core/context/ToastContext';

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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !startDate) {
            toast.error('Please fill in required fields');
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
            console.error(error);
            toast.error('Failed to create campaign');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#161b22] border border-gray-800 rounded-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Plus className="text-blue-500" />
                        New Campaign
                    </h2>
                    <button onClick={onClose} aria-label="Close modal" className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="campaign-title" className="block text-sm font-medium text-gray-400 mb-1">Campaign Name *</label>
                        <input
                            id="campaign-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Summer Single Release"
                            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="campaign-description" className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                        <textarea
                            id="campaign-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief overview of the campaign..."
                            className="w-full h-24 bg-[#0d1117] border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="campaign-start-date" className="block text-sm font-medium text-gray-400 mb-1">Start Date *</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 text-gray-500" size={16} />
                                <input
                                    id="campaign-start-date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2.5 pl-10 text-white focus:border-blue-500 outline-none"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="campaign-end-date" className="block text-sm font-medium text-gray-400 mb-1">End Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 text-gray-500" size={16} />
                                <input
                                    id="campaign-end-date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2.5 pl-10 text-white focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="campaign-platform" className="block text-sm font-medium text-gray-400 mb-1">Platform</label>
                        <select
                            id="campaign-platform"
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value)}
                            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                        >
                            <option>Instagram</option>
                            <option>Twitter</option>
                            <option>TikTok</option>
                            <option>LinkedIn</option>
                            <option>Multi-platform</option>
                        </select>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors border border-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? 'Creating...' : 'Launch Campaign'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
