import React, { useState } from 'react';
import { ShieldCheck, Music, Image as ImageIcon, Tag, XCircle, CheckCircle } from 'lucide-react';

export const QCVisualizer: React.FC = () => {
    // Mock Quality Control (QC) Visualizer (Item 174)
    const [checks] = useState([
        { id: '1', type: 'Audio True Peak', value: '-1.0 dBTP', passed: true, icon: Music },
        { id: '2', type: 'Artwork Resolution', value: '3000x3000px', passed: true, icon: ImageIcon },
        { id: '3', type: 'Explicit Tagging', value: 'Not Tagged (Detected: None)', passed: true, icon: Tag },
        { id: '4', type: 'ISRC Format', value: 'US-XYZ-23-00001', passed: true, icon: ShieldCheck }
    ]);

    const allPassed = checks.every(c => c.passed);

    return (
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 text-gray-200">
            <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                <div>
                    <h2 className="text-xl font-bold font-mono">Distribution Delivery Gateway</h2>
                    <p className="text-sm text-gray-400 mt-1">Strictly-enforced QC visualizer matching DSP requirements.</p>
                </div>
                <div className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${allPassed ? 'bg-green-900/20 text-green-400 border border-green-500/30' : 'bg-red-900/20 text-red-400 border border-red-500/30'}`}>
                    {allPassed ? <CheckCircle size={18} /> : <XCircle size={18} />}
                    {allPassed ? 'Cleared for Delivery' : 'Delivery Blocked'}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {checks.map(check => (
                    <div key={check.id} className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${check.passed ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                            <check.icon size={20} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-400">{check.type}</p>
                            <p className="font-medium">{check.value}</p>
                        </div>
                        <div>
                            {check.passed ? (
                                <span className="text-xs font-bold text-green-500 uppercase tracking-wider">PASS</span>
                            ) : (
                                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">FAIL</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <button
                disabled={!allPassed}
                className={`w-full mt-6 py-3 rounded-lg font-medium transition-all ${allPassed ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
            >
                Execute Delivery
            </button>
        </div>
    );
};
