import { LockKeyhole, ShieldAlert } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { useStore } from '@/core/store';

/**
 * Investor data is not yet backed by an entitlement provider or verified cap
 * table. Never substitute a cinematic client-side gesture for authorization.
 */
export default function InvestorPortal() {
    const { user } = useStore(useShallow(state => ({ user: state.user })));

    return (
        <ModuleErrorBoundary moduleName="Investor">
            <div className="flex h-full w-full items-center justify-center bg-black p-8 text-white">
                <section className="w-full max-w-2xl rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8 text-center">
                    <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-amber-300" />
                    <h1 className="text-2xl font-bold">Investor portal unavailable</h1>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-300">
                        This account is signed in{user?.email ? ` as ${user.email}` : ''}, but indii has no
                        verified investor entitlement, cap-table source, valuation feed, or advisory channel
                        connected for it. No access was granted and no financial figures are being inferred.
                    </p>
                    <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-4 py-2 text-xs text-neutral-400">
                        <LockKeyhole size={14} /> Real server authorization is required before investor data can appear
                    </div>
                </section>
            </div>
        </ModuleErrorBoundary>
    );
}
