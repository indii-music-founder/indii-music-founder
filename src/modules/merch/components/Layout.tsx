import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid, PenTool, Package, Settings, LogOut } from 'lucide-react';

export const MerchLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-black/50 backdrop-blur-xl flex flex-col z-20">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#FFE135] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(255,225,53,0.3)]">
                        <span className="text-black font-black text-lg">B</span>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight leading-none">Banana<span className="text-[#FFE135]">Pro</span></h1>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">Merch OS</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1">
                    <NavItem to="/merch" icon={<LayoutGrid size={18} />} exact>Dashboard</NavItem>
                    <NavItem to="/merch/design" icon={<PenTool size={18} />}>Designer</NavItem>
                    <NavItem to="/merch/catalog" icon={<Package size={18} />}>Catalog</NavItem>
                    <div className="pt-6 pb-2">
                        <div className="h-px bg-white/5 mx-2" />
                    </div>
                    <NavItem to="/merch/settings" icon={<Settings size={18} />}>Settings</NavItem>
                </nav>

                <div className="p-4 border-t border-white/5">
                    <button className="flex items-center gap-3 text-neutral-500 hover:text-white transition-colors w-full px-4 py-2 text-sm font-medium rounded-lg hover:bg-white/5">
                        <LogOut size={18} />
                        <span>Exit Studio</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col relative overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#FFE135]/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#CCFF00]/5 rounded-full blur-[120px] pointer-events-none" />

                <div className="flex-1 overflow-auto p-8 relative z-10 custom-scrollbar">
                    {children}
                </div>
            </main>
        </div>
    );
};

const NavItem = ({ to, icon, children, exact }: { to: string, icon: React.ReactNode, children: React.ReactNode, exact?: boolean }) => (
    <NavLink
        to={to}
        end={exact}
        className={({ isActive }: { isActive: boolean }) => `
            flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
            ${isActive
                ? 'bg-[#FFE135]/10 text-[#FFE135] shadow-[0_0_10px_rgba(255,225,53,0.1)] border border-[#FFE135]/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'}
        `}
    >
        {icon}
        {children}
    </NavLink>
);
