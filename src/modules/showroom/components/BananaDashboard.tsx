import React from 'react';
import { BananaTheme } from '@/modules/showroom/themes';

interface BananaDashboardProps {
    theme: BananaTheme;
}

export default function BananaDashboard({ theme }: BananaDashboardProps) {
    const isPro = theme.name === 'pro';

    return (
        <div className={`flex flex-col gap-6 p-6 h-full overflow-y-auto ${theme.colors.text}`}>
            {/* Header */}
            <div className={`p-6 ${theme.colors.surface} ${theme.effects.glass} ${theme.effects.shadow} ${theme.effects.borderRadius} border ${theme.colors.border}`}>
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        {isPro ? '🍌' : '🍌'} {isPro ? 'Banana Pro Analytics' : 'Banana Overview'}
                    </h2>
                    {isPro && <span className={`px-3 py-1 text-xs font-bold rounded-full ${theme.colors.accent} text-black`}>PRO ACTIVE</span>}
                </div>
                <p className={`text-sm ${theme.colors.textSecondary}`}>
                    {isPro ? 'Real-time potassium liquidity flows and ripeness derivatives.' : 'Tracking your bunch health and peel quality.'}
                </p>
            </div>

            {/* Widgets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Widget 1: Ripeness Tracker */}
                <div className={`p-5 ${theme.colors.surface} ${theme.effects.glass} ${theme.effects.shadow} ${theme.effects.borderRadius} border ${theme.colors.border}`}>
                    <h3 className="text-lg font-semibold mb-4">Ripeness Tracker</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between text-sm">
                            <span>Current Stage</span>
                            <span className="font-bold">{isPro ? 'OPTIMAL (4.20)' : 'Perfectly Yellow'}</span>
                        </div>
                        <div className="w-full h-4 bg-gray-200/20 rounded-full overflow-hidden">
                            <div className={`h-full ${theme.colors.accent} ${theme.effects.glow}`} style={{ width: '85%' }} />
                        </div>
                        <p className={`text-xs ${theme.colors.textSecondary}`}>
                            {isPro ? 'Decay rate -0.05% / hr. Cooling systems nominal.' : 'Ready to eat! Best flavor profile reached.'}
                        </p>
                    </div>
                </div>

                {/* Widget 2: Peel Performance */}
                <div className={`p-5 ${theme.colors.surface} ${theme.effects.glass} ${theme.effects.shadow} ${theme.effects.borderRadius} border ${theme.colors.border}`}>
                    <h3 className="text-lg font-semibold mb-4">Peel Performance</h3>
                    <div className="flex items-end gap-2 h-24 mt-2">
                        {[40, 65, 55, 80, 70, 90, 85].map((h, i) => (
                            <div key={i} className={`flex-1 ${theme.colors.accent} ${theme.effects.glow} rounded-t-sm`} style={{ height: `${h}%`, opacity: (i + 3) / 10 }} />
                        ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs opacity-60">
                        <span>Mon</span><span>Sun</span>
                    </div>
                </div>

                {/* Widget 3: Bunch Analytics (Pro Only or Locked) */}
                <div className={`col-span-1 md:col-span-2 p-5 ${theme.colors.surface} ${theme.effects.glass} ${theme.effects.shadow} ${theme.effects.borderRadius} border ${theme.colors.border} relative overflow-hidden`}>
                    <h3 className="text-lg font-semibold mb-2">Global Bunch Metrics</h3>

                    {!isPro && (
                        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="bg-white/90 p-4 rounded-xl shadow-xl text-center">
                                <p className="text-gray-900 font-bold mb-1">Upgrade to Banana Pro</p>
                                <p className="text-gray-600 text-sm">Unlock advanced bunch analytics.</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className={`p-3 rounded-lg ${theme.colors.surfaceHighlight}`}>
                            <div className="text-2xl font-bold">1,240</div>
                            <div className={`text-xs ${theme.colors.textSecondary}`}>Daily Peels</div>
                        </div>
                        <div className={`p-3 rounded-lg ${theme.colors.surfaceHighlight}`}>
                            <div className="text-2xl font-bold">+12%</div>
                            <div className={`text-xs ${theme.colors.textSecondary}`}>Potassium</div>
                        </div>
                        <div className={`p-3 rounded-lg ${theme.colors.surfaceHighlight}`}>
                            <div className="text-2xl font-bold">99.9%</div>
                            <div className={`text-xs ${theme.colors.textSecondary}`}>Uptime</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
