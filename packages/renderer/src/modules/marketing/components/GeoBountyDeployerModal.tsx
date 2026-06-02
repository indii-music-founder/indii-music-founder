import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function GeoBountyDeployerModal({ onClose, onDeploy }: { onClose: () => void, onDeploy: (loc: string, desc: string) => void }) {
    const [location, setLocation] = useState('');
    const [missionDescription, setMissionDescription] = useState('');

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-surface border border-border rounded-xl p-6 shadow-2xl flex flex-col gap-4"
            >
                <h2 className="text-2xl font-bold text-white">Create Mission</h2>
                <p className="text-sm text-text-secondary">Deploy a Geo-Bounty to the SoundLocker community.</p>
                
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-white">Location</label>
                    <input
                        type="text"
                        name="location"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        className="px-3 py-2 bg-background/50 border border-border rounded-md focus:outline-none focus:border-dept-marketing text-white"
                        placeholder="e.g. Chicago, IL"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-white">Mission Description</label>
                    <textarea
                        name="missionDescription"
                        value={missionDescription}
                        onChange={e => setMissionDescription(e.target.value)}
                        className="px-3 py-2 bg-background/50 border border-border rounded-md focus:outline-none focus:border-dept-marketing h-24 resize-none text-white"
                    />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 hover:bg-white/10 text-white rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onDeploy(location, missionDescription)}
                        className="px-4 py-2 bg-dept-marketing hover:bg-dept-marketing-glow text-white rounded-lg font-medium transition-colors"
                    >
                        Deploy
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
