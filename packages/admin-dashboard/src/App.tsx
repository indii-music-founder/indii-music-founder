import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  Users,
  LayoutDashboard,
  Database,
  BarChart3,
  Bell,
  ShieldCheck,
  Loader2,
  LogOut
} from 'lucide-react';
import { FoundersPortal } from './components/modules/FoundersPortal';
import { TokenUsage } from './components/modules/TokenUsage';
import { LoginScreen } from './components/LoginScreen';
import { auth, ADMIN_TOKEN_KEY } from './firebase';

const ADMIN_EMAIL_DOMAIN = '@indii.music';

/**
 * Auth gate. Observes the Firebase session and only renders the dashboard for an
 * @indii.music admin. Stores a fresh ID token in localStorage so the data
 * modules can call the (token-gated) backend. No bypass — real session or login.
 */
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u && u.email?.endsWith(ADMIN_EMAIL_DOMAIN)) {
        try {
          const token = await u.getIdToken();
          localStorage.setItem(ADMIN_TOKEN_KEY, token);
        } catch {
          /* token refresh handled on next call */
        }
        setUser(u);
      } else {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        setUser(u && !u.email?.endsWith(ADMIN_EMAIL_DOMAIN) ? u : null);
      }
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0A0B] text-white">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  // Signed in but NOT an admin domain — honest refusal, with a way out.
  if (user && !user.email?.endsWith(ADMIN_EMAIL_DOMAIN)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0A0A0B] text-white">
        <ShieldCheck className="w-10 h-10 text-red-400" />
        <p className="text-white/80 font-semibold">This account is not an indii admin.</p>
        <p className="text-white/40 text-sm">{user.email}</p>
        <button
          onClick={() => signOut(auth)}
          className="mt-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <AdminDashboard user={user} />;
};

const AdminDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [activeModule, setActiveModule] = useState('Token Usage');

  // Only modules backed by REAL data are exposed. Mock-only modules (Email
  // Manager, DDEX Tracker, Nexus Monitor) are intentionally hidden until they
  // are wired to real sources — no placeholder/fake data is ever shown.
  const modules = [
    { name: 'Token Usage', icon: <BarChart3 className="w-5 h-5" />, color: 'text-blue-400' },
    { name: 'Founders Portal', icon: <Users className="w-5 h-5" />, color: 'text-orange-400' },
  ];

  return (
    <div className="flex h-screen bg-[#0A0A0B] text-white font-sans selection:bg-blue-500/30">
      {/* Sidebar */}
      <aside className="w-72 bg-[#121214] border-r border-white/5 flex flex-col">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">indii<span className="text-blue-500">OS</span></h1>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Admin Nexus</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          <div className="text-[10px] text-white/20 uppercase tracking-widest font-bold px-4 mb-4 mt-6">Core Systems</div>
          {modules.map((module) => (
            <button
              key={module.name}
              onClick={() => setActiveModule(module.name)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group ${
                activeModule === module.name 
                ? 'bg-white/5 text-white shadow-inner' 
                : 'text-white/40 hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <div className={`${activeModule === module.name ? module.color : 'text-white/20 group-hover:text-white/40'} transition-colors`}>
                {module.icon}
              </div>
              <span className="font-medium text-sm">{module.name}</span>
              {activeModule === module.name && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5">
          <div className="bg-white/[0.03] rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border border-white/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-white/60" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/90 truncate">{user.displayName || 'Admin'}</p>
              <p className="text-[11px] text-white/40 truncate">{user.email}</p>
            </div>
            <button
              onClick={() => signOut(auth)}
              title="Sign out"
              className="ml-auto text-white/20 hover:text-white/60 cursor-pointer transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Background Gradients */}
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-[#0A0A0B]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <LayoutDashboard className="w-5 h-5 text-white/20" />
            <h2 className="text-lg font-semibold tracking-tight">{activeModule}</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] font-bold text-green-500 uppercase tracking-wider">System Live</span>
            </div>
            <div className="relative">
              <Bell className="w-5 h-5 text-white/40 hover:text-white cursor-pointer transition-colors" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0A0A0B]" />
            </div>
            <div className="h-8 w-[1px] bg-white/5" />
            <Database className="w-5 h-5 text-white/40 hover:text-white cursor-pointer transition-colors" />
          </div>
        </header>

        {/* Module Content */}
        <div className="flex-1 overflow-y-auto p-10 z-10">
          <div className="max-w-6xl mx-auto space-y-10">
            {activeModule === 'Token Usage' ? (
              <TokenUsage />
            ) : activeModule === 'Founders Portal' ? (
              <FoundersPortal />
            ) : (
              <div className="flex items-center justify-center h-64 border border-white/5 bg-white/[0.02] rounded-3xl border-dashed">
                <p className="text-white/40 text-sm font-medium tracking-wide">
                  {activeModule} module is currently under construction.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
