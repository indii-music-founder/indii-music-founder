import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, PieChart, Download, DollarSign, Users, Activity } from 'lucide-react';

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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#ff3366]/10 to-transparent -translate-x-full group-hover:animate-shimmer" />

                <div className="relative z-10">
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-2 uppercase tracking-tighter mix-blend-difference">
                        DETROIT 8 <span className="text-[#ff3366]">OPS_CENTER</span>
                    </h1>
                    <div className="flex flex-wrap gap-4 text-xs md:text-sm font-bold text-[#ff3366] uppercase tracking-widest">
                        <span className="bg-[#ff3366]/20 px-2 py-1">ID: {architect.name}</span>
                        <span className="bg-[#ff3366]/20 px-2 py-1">ROLE: {architect.role}</span>
                        <span className="bg-[#ff3366]/20 px-2 py-1">CLEARANCE: {architect.clearance}</span>
                    </div>
                </div>
                <button className="relative z-10 mt-6 md:mt-0 px-6 py-3 bg-[#00ff66] text-black font-black uppercase text-sm tracking-widest hover:bg-white hover:text-black transition-colors transform hover:-translate-y-1 hover:shadow-[4px_4px_0px_#ff3366] active:translate-y-0 active:shadow-none flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    [ DL_DOSSIER ]
                </button>
            </div>

            {/* Main Stats - The "Big Numbers" */}
            <div className="md:col-span-8 grid grid-cols-2 gap-4 md:gap-8">
                <StatCard
                    label="EST. VALUATION"
                    value="$10,000,000"
                    subvalue="+125% YTD"
                    icon={DollarSign}
                    delay={0.1}
                />
                <StatCard
                    label="YOUR STAKE"
                    value="1.25%"
                    subvalue="~ $125,000"
                    icon={PieChart}
                    delay={0.2}
                    highlight
                />
                <StatCard
                    label="ACTIVE USERS"
                    value="1,240"
                    subvalue="Waitlist: 15,000"
                    icon={Users}
                    delay={0.3}
                />
                <StatCard
                    label="RUNWAY"
                    value="18 MO"
                    subvalue="Burn: $45k/mo"
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

                    {/* Active Ring (25%) */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle cx="128" cy="128" r="124" stroke="currentColor" strokeWidth="8" fill="none"
                            strokeDasharray="779" strokeDashoffset={779 - (779 * 0.25)}
                            className="text-[#00ff66] drop-shadow-[0_0_10px_rgba(0,255,100,0.5)]"
                        />
                    </svg>

                    <div className="text-center z-10">
                        <div className="text-6xl font-black text-white mix-blend-difference tracking-tighter">25%</div>
                        <div className="text-xs font-bold uppercase tracking-widest mt-1 text-[#ff3366]">[ VESTED ]</div>
                    </div>

                    {/* Decorative Ticks (Crosshairs) */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-[#1a1a1a]" />
                        <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-[#1a1a1a]" />
                    </div>
                </div>

                <div className="w-full space-y-2 mt-auto relative z-10">
                    <div className="flex justify-between text-xs font-bold font-mono text-[#e0e0e0]">
                        <span>START: DEC 2025</span>
                        <span>CLIFF: DEC 2026</span>
                    </div>
                    <div className="w-full h-2 bg-[#1a1a1a] overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '25%' }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="h-full bg-[#ff3366]"
                        />
                    </div>
                </div>
            </div>

            {/* Recent Activity / Feed */}
            <div className="md:col-span-12 border-t-2 border-[#1a1a1a] pt-6 relative">
                {/* Dopamine line */}
                <div className="absolute top-0 left-0 w-1/4 h-[2px] bg-[#00ff66] shadow-[0_0_10px_#00ff66]" />

                <h3 className="text-sm font-bold font-mono tracking-widest text-[#00ff66] mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    SYSTEM LOGS // ACTIVITY
                </h3>
                <div className="space-y-3 font-mono text-sm max-h-48 overflow-y-auto pr-4 custom-scrollbar">
                    <LogEntry time="10:42:15" msg="New Agency Partner onboarded: [REDACTED]" />
                    <LogEntry time="09:15:00" msg="Revenue milestone achieved: $50k MRR" highlight />
                    <LogEntry time="YESTERDAY" msg="System update v0.1.0-beta.2 deployed" />
                    <LogEntry time="YESTERDAY" msg="Detroit 8 Protocol initiated" />
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
