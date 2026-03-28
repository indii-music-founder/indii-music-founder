import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MissionBrief } from './components/MissionBrief';
import { ProtocolAuth } from './components/ProtocolAuth';
import { EquityDashboard } from './components/EquityDashboard';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

type PortalStep = 'brief' | 'auth' | 'dashboard';

export default function InvestorPortal() {
    const [step, setStep] = useState<PortalStep>('brief');
    const { user } = useStore(useShallow(state => ({
        user: state.user
    })));

    // Mock "Founding Architect" data
    const architectData = {
        name: user?.displayName || 'Architect',
        role: 'Founding Partner',
        clearance: 'Level 5 (Omni)',
    };

    return (
        <ModuleErrorBoundary moduleName="Investor">
            <div className="h-full w-full bg-black text-green-500 font-mono overflow-hidden relative selection:bg-green-900 selection:text-green-100">
                {/* CRT/Scanline Overlay */}
                <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] bg-repeat" />

                <AnimatePresence mode="wait">
                    {step === 'brief' && (
                        <MissionBrief
                            key="brief"
                            onAccept={() => setStep('auth')}
                        />
                    )}
                    {step === 'auth' && (
                        <ProtocolAuth
                            key="auth"
                            architectName={architectData.name}
                            onAuthenticated={() => setStep('dashboard')}
                        />
                    )}
                    {step === 'dashboard' && (
                        <EquityDashboard
                            key="dashboard"
                            architect={architectData}
                        />
                    )}
                </AnimatePresence>
            </div>
        </ModuleErrorBoundary>
    );
}
