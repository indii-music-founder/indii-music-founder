import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, PieChart, Download, DollarSign, Users, Activity, Radio, UploadCloud, MessageSquare } from 'lucide-react';
import { secureRandomInt } from '@/utils/crypto-random';

interface EquityDashboardProps {
    architect: {
        name: string;
        role: string;
        clearance: string;
    };
}

export const EquityDashboard = ({ architect }: EquityDashboardProps) => {
    return (
        <motion.div
            initial={{ filter: 'blur(20px)', opacity: 0, scale: 0.98 }}
            animate={{ filter: 'blur(0px)', opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="p-4 md:p-8 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 h-full bg-[#0a0a0a] text-[#e0e0e0] font-mono relative"
        >
            {/* Blueprint Grid Background */}
            <div className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                    backgroundImage: 'linear-gradient(rgba(0, 255, 100, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 100, 0.2) 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}
            />

            {/* Header / ID Card (Elevated Brutalism) */}
            <div className="md:col-span-12 border-2 border-[#ff3366] bg-black p-6 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden group">
                {/* Dopamine Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#ff3366]/10 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row gap-6 w-full justify-between items-start md:items-center">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mix-blend-difference drop-shadow-[0_0_10px_rgba(255,51,102,0.8)]">
                                DETROIT 8 <span className="text-[#ff3366]">OPS_CENTER</span>
                            </h1>
                            {/* Merlin Infrastructure Status Light */}
                            <div className="flex items-center gap-2 bg-[#1a1a1a] px-4 py-2 border border-[#00ff66]/50 group-hover:border-[#00ff66] transition-colors shadow-[0_0_15px_rgba(0,255,102,0.2)]">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff66] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00ff66] drop-shadow-[0_0_8px_rgba(0,255,102,1)]"></span>
                                </span>
                                <span className="text-[10px] font-bold tracking-widest text-[#00ff66] uppercase">
                                    <DecodeText text="Merlin Link: ACTIVE" delay={1500} />
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs md:text-sm font-bold text-[#ff3366] uppercase tracking-widest">
                            <span className="bg-[#ff3366]/20 px-2 py-1">ID: {architect.name}</span>
                            <span className="bg-[#ff3366]/20 px-2 py-1">ROLE: {architect.role}</span>
                            <span className="bg-[#ff3366]/20 px-2 py-1">CLEARANCE: {architect.clearance}</span>
                        </div>
                    </div>
                    <button className="relative z-10 px-6 py-3 bg-[#00ff66] text-black font-black uppercase text-sm tracking-widest hover:bg-white hover:text-black transition-colors transform hover:-translate-y-1 hover:shadow-[4px_4px_0px_#ff3366] active:translate-y-0 active:shadow-none flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        [ DL_DOSSIER ]
                    </button>
                </div>
            </div>

            {/* Main Stats - The "Big Numbers" */}
            <div className="md:col-span-8 grid grid-cols-2 gap-4 md:gap-8">
                <StatCard
                    label="EST. VALUATION"
                    value="--"
                    subvalue="Connect investor portal"
                    icon={DollarSign}
                    delay={0.1}
                />
                <StatCard
                    label="YOUR STAKE"
                    value="--"
                    subvalue="Not configured"
                    icon={PieChart}
                    delay={0.2}
                    highlight
                />
                <StatCard
                    label="ACTIVE USERS"
                    value="--"
                    subvalue="Connect analytics"
                    icon={Users}
                    delay={0.3}
                />
                <StatCard
                    label="RUNWAY"
                    value="--"
                    subvalue="Connect financials"
                    icon={Activity}
                    delay={0.4}
                />
            </div>

            {/* Vesting Visualization (The "Calibration Ring") */}
            <div className="md:col-span-4 border-2 border-[#1a1a1a] bg-black p-6 flex flex-col items-center justify-center relative overflow-hidden group">
                <h3 className="absolute top-4 left-4 text-xs font-bold font-mono tracking-widest text-[#00ff66]">VESTING SCHEDULE</h3>

                <div className="relative w-64 h-64 flex items-center justify-center my-8">
                    {/* Background Ring */}
                    <div className="absolute inset-0 border-4 border-[#1a1a1a] rounded-full" />

                    {/* Active Ring (0% until configured) */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle cx="128" cy="128" r="124" stroke="currentColor" strokeWidth="8" fill="none"
                            strokeDasharray="779" strokeDashoffset={779}
                            className="text-[#00ff66] drop-shadow-[0_0_10px_rgba(0,255,100,0.5)]"
                        />
                    </svg>

                    <div className="text-center z-10">
                        <div className="text-6xl font-black text-white mix-blend-difference tracking-tighter">--</div>
                        <div className="text-xs font-bold uppercase tracking-widest mt-1 text-[#ff3366]">[ NOT SET ]</div>
                    </div>

                    {/* Decorative Ticks (Crosshairs) */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-[#1a1a1a]" />
                        <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-[#1a1a1a]" />
                    </div>
                </div>

                <div className="w-full space-y-2 mt-auto relative z-10">
                    <div className="flex justify-between text-xs font-bold font-mono text-[#e0e0e0]">
                        <span>START: --</span>
                        <span>CLIFF: --</span>
                    </div>
                    <div className="w-full h-2 bg-[#1a1a1a] overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '0%' }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="h-full bg-[#ff3366]"
                        />
                    </div>
                </div>
            </div>

            {/* Priority Node Access & Direct Communication */}
            <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">

                {/* Priority Node - Distribution Interface */}
                <div className="border-2 border-[#1a1a1a] p-6 hover:border-[#00ff66] transition-colors relative group overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#00ff66]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    {/* Scanline effect for terminal */}
                    <div className="absolute left-0 right-0 h-1 bg-[#00ff66]/20 shadow-[0_0_15px_#00ff66] z-0 animate-scanline opacity-0 group-hover:opacity-50 pointer-events-none" />

                    <h3 className="text-sm font-bold font-mono tracking-widest text-[#00ff66] mb-6 flex items-center gap-2 drop-shadow-[0_0_5px_rgba(0,255,102,0.5)]">
                        <UploadCloud className="w-5 h-5" />
                        PRIORITY NODE // DISTRIBUTION
                    </h3>
                    <div className="space-y-4 relative z-10">
                        <p className="text-xs text-[#8b949e]">
                            <DecodeText text="Your Lifetime Utility Node is active. Generate ISRC codes and push direct-to-DSP via Merlin." delay={500} />
                        </p>

                        <div className="p-4 border border-[#00ff66]/30 bg-black/80 shadow-[inset_0_0_20px_rgba(0,255,102,0.05)]">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-white">UPC:</span>
                                <span className="text-xs font-mono text-[#00ff66]/50">Not assigned</span>
                            </div>
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-bold text-white">LATEST ISRC:</span>
                                <span className="text-xs font-mono text-[#00ff66]/50">Not assigned</span>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02, boxShadow: "0 0 15px rgba(0, 255, 102, 0.4)" }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-3 border-2 border-[#00ff66] text-[#00ff66] font-bold text-xs uppercase tracking-widest hover:bg-[#00ff66] hover:text-black transition-all duration-300 relative overflow-hidden group/btn"
                            >
                                <span className="relative z-10">PUSH TO MERLIN NETWORK</span>
                                <div className="absolute inset-0 bg-[#00ff66] opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                            </motion.button>
                        </div>
                    </div>
                </div>

                {/* Strategic Advisor (Ghost Advisory) Chat */}
                <div className="border-2 border-[#1a1a1a] p-6 hover:border-[#ff3366] transition-colors relative group flex flex-col h-full">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#ff3366]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <h3 className="text-sm font-bold font-mono tracking-widest text-[#ff3366] mb-6 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        GHOST ADVISORY // STRATEGIC LINK
                    </h3>
                    <div className="flex-1 space-y-4 relative z-10 overflow-y-auto min-h-[150px] mb-4 pr-2 custom-scrollbar">
                        <div className="text-xs text-[#e0e0e0] opacity-50 italic">Secure channel established. Waiting for connection...</div>
                    </div>
                    <div className="relative z-10 mt-auto flex gap-2">
                        <input
                            type="text"
                            placeholder="TRANSMIT DIRECTIVE..."
                            className="flex-1 bg-transparent border-b-2 border-[#1a1a1a] focus:border-[#ff3366] outline-none text-sm font-mono pb-2 text-white placeholder:text-[#8b949e] transition-colors"
                        />
                        <button className="text-[#ff3366] font-bold text-xs uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1">
                            <Radio className="w-4 h-4" /> SEND
                        </button>
                    </div>
                </div>

            </div>

            {/* Recent Activity / Feed */}
            <div className="md:col-span-12 border-t-2 border-[#1a1a1a] pt-6 relative mt-4">
                {/* Dopamine line */}
                <div className="absolute top-0 left-0 w-1/4 h-[2px] bg-[#00ff66] shadow-[0_0_10px_#00ff66]" />

                <h3 className="text-sm font-bold font-mono tracking-widest text-[#00ff66] mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    SYSTEM LOGS // ACTIVITY
                </h3>
                <div className="space-y-3 font-mono text-sm max-h-48 overflow-y-auto pr-4 custom-scrollbar">
                    <div className="py-8 text-center text-[#8b949e] text-xs">No activity recorded yet</div>
                </div>
            </div>
        </motion.div>
    );
};

const StatCard = ({ label, value, subvalue, icon: Icon, delay, highlight }: any) => (
    <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay }}
        className={`p-6 border-2 relative overflow-hidden group ${highlight ? 'border-[#ff3366] bg-[#ff3366]/10' : 'border-[#1a1a1a] bg-black'} hover:border-[#00ff66] transition-colors cursor-crosshair`}
    >
        {/* Hover Dopamine Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#00ff66]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
                <span className={`text-xs font-bold tracking-widest ${highlight ? 'text-[#ff3366]' : 'text-[#8b949e]'}`}>{label}</span>
                <Icon className={`w-6 h-6 ${highlight ? 'text-[#ff3366]' : 'text-[#e0e0e0] group-hover:text-[#00ff66]'}`} />
            </div>
            <div className={`text-4xl md:text-5xl font-black mb-1 tracking-tighter ${highlight ? 'text-white' : 'text-[#00ff66]'}`}>
                {value}
            </div>
            <div className="text-xs font-bold opacity-60 mt-2 border-l-2 border-[#1a1a1a] pl-2">
                {subvalue}
            </div>
        </div>
    </motion.div>
);

const LogEntry = ({ time, msg, highlight }: any) => (
    <div className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-6 p-3 border-l-2 ${highlight ? 'border-[#ff3366] bg-[#ff3366]/5 text-white' : 'border-[#1a1a1a] hover:border-[#00ff66] hover:bg-[#00ff66]/5 text-[#e0e0e0]'} transition-colors`}>
        <span className="text-[#8b949e] min-w-[100px] text-xs font-bold">{time}</span>
        <span className="text-sm">{msg}</span>
    </div>
);

const DecodeText = ({ text, delay }: { text: string; delay: number }) => {
    const [visibleText, setVisibleText] = React.useState('');
    const [started, setStarted] = React.useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => setStarted(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    React.useEffect(() => {
        if (!started) return;

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*<>[]{}';
        let iteration = 0;

        const interval = setInterval(() => {
            setVisibleText(text.split('').map((letter, index) => {
                if (index < iteration) {
                    return text[index];
                }
                return chars[secureRandomInt(0, chars.length - 1)];
            }).join(''));

            if (iteration >= text.length) {
                clearInterval(interval);
            }
            iteration += 1 / 2; // Decodes somewhat fast
        }, 30);

        return () => clearInterval(interval);
    }, [text, started]);

    if (!started) return <span className="invisible">{text}</span>;

    return <span>{visibleText}</span>;
};
