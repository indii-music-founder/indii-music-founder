import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CRMDashboard() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [campaigns, setCampaigns] = useState<{ id: string, name: string, supply: string, price: string }[]>([]);
    
    // Form state
    const [campaignName, setCampaignName] = useState('');
    const [supply, setSupply] = useState('');
    const [price, setPrice] = useState('');

    const handleLaunch = () => {
        setCampaigns(prev => [...prev, {
            id: Date.now().toString(),
            name: campaignName,
            supply,
            price
        }]);
        setIsModalOpen(false);
        setCampaignName('');
        setSupply('');
        setPrice('');
    };

    return (
        <div className="flex flex-col h-full w-full bg-surface text-text-primary p-6 gap-6 relative">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Superfan CRM</h1>
                    <p className="text-text-secondary mt-1">Manage your SoundLocker ecosystem and fan engagements.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 bg-accent-primary hover:bg-accent-secondary text-white rounded-lg font-medium transition-colors"
                >
                    New Drop
                </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campaigns.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-xl text-text-secondary">
                        <p>No active campaigns yet.</p>
                        <p className="text-sm">Create a new drop to engage your fans.</p>
                    </div>
                ) : (
                    campaigns.map(camp => (
                        <div key={camp.id} className="p-4 border border-border bg-background rounded-xl flex flex-col gap-2">
                            <h3 className="font-semibold text-lg">{camp.name}</h3>
                            <div className="flex justify-between text-sm text-text-secondary">
                                <span>Supply: {camp.supply}</span>
                                <span>Price: ${camp.price}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* New Drop Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md bg-surface border border-border rounded-xl p-6 shadow-2xl flex flex-col gap-4"
                        >
                            <h2 className="text-2xl font-bold">Create Campaign</h2>
                            <p className="text-sm text-text-secondary">Launch a new Digital Vinyl drop.</p>
                            
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Campaign Name</label>
                                <input
                                    type="text"
                                    name="campaignName"
                                    value={campaignName}
                                    onChange={e => setCampaignName(e.target.value)}
                                    className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:border-accent-primary"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Supply</label>
                                <input
                                    type="number"
                                    name="supply"
                                    value={supply}
                                    onChange={e => setSupply(e.target.value)}
                                    className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:border-accent-primary"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Price (USD)</label>
                                <input
                                    type="number"
                                    name="price"
                                    step="0.01"
                                    value={price}
                                    onChange={e => setPrice(e.target.value)}
                                    className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:border-accent-primary"
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-4">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 hover:bg-border rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleLaunch}
                                    className="px-4 py-2 bg-accent-primary hover:bg-accent-secondary text-white rounded-lg font-medium transition-colors"
                                >
                                    Launch
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
