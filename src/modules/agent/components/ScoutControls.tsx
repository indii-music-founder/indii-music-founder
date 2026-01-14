import React from 'react';
import { Search, Sparkles, Check, Wand2 } from 'lucide-react';

interface ScoutControlsProps {
    city: string;
    setCity: (city: string) => void;
    genre: string;
    setGenre: (genre: string) => void;
    isAutonomous: boolean;
    setIsAutonomous: (val: boolean) => void;
    handleScan: () => void;
    isScanning: boolean;
}

export const ScoutControls: React.FC<ScoutControlsProps> = ({
    city,
    setCity,
    genre,
    setGenre,
    isAutonomous,
    setIsAutonomous,
    handleScan,
    isScanning
}) => {
    return (
        <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 rounded-2xl blur-lg opacity-50 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-1.5 rounded-2xl shadow-2xl flex items-center gap-2">

                {/* City Input */}
                <div className="relative flex-1 min-w-[180px] group/input">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-500 group-focus-within/input:text-emerald-400 transition-colors" />
                    </div>
                    <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 bg-slate-950/50 border border-transparent rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:bg-slate-950 focus:ring-1 focus:ring-slate-700 transition-all font-medium sm:text-sm"
                        placeholder="Target City (e.g. Nashville)"
                        aria-label="Target City"
                    />
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-slate-800"></div>

                {/* Genre Input */}
                <div className="relative flex-1 min-w-[180px] group/input">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Wand2 className="h-4 w-4 text-slate-500 group-focus-within/input:text-emerald-400 transition-colors" />
                    </div>
                    <input
                        type="text"
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 bg-slate-950/50 border border-transparent rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:bg-slate-950 focus:ring-1 focus:ring-slate-700 transition-all font-medium sm:text-sm"
                        placeholder="Focus Genre (e.g. Rock)"
                        aria-label="Focus Genre"
                    />
                </div>

                {/* Autonomous Toggle */}
                <button
                    onClick={() => setIsAutonomous(!isAutonomous)}
                    role="switch"
                    aria-checked={isAutonomous}
                    aria-label="Toggle autonomous mode"
                    className={`
                        relative flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all border outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
                        ${isAutonomous
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-slate-950/50 border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'}
                    `}
                >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isAutonomous ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                        {isAutonomous && <Check size={10} className="text-slate-950 stroke-[3]" />}
                    </div>
                    <span className="whitespace-nowrap">Auto Mode</span>
                </button>

                {/* Deploy Button */}
                <button
                    data-testid="deploy-scout-btn"
                    onClick={handleScan}
                    disabled={isScanning}
                    aria-busy={isScanning}
                    className={`
                        flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm tracking-wide shadow-lg transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
                        ${isScanning
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-110 active:scale-[0.98] shadow-emerald-500/20'}
                    `}
                >
                    {isScanning ? (
                        <>
                            <div data-testid="scout-loading-spinner" className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Running...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles size={16} className="fill-white/20" />
                            <span>Deploy Scout</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
