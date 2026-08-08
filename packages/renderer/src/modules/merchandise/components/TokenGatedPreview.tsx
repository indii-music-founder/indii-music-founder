import { Lock, ServerOff, Wallet } from 'lucide-react';

/**
 * Token-gated streaming requires server-side ownership verification, protected
 * media delivery, and a durable preview record. None of those boundaries are
 * deployed yet, so this surface must remain an explicit availability notice.
 */
export function TokenGatedPreview() {
    return (
        <div className="space-y-5">
            <div>
                <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                    <Lock size={15} className="text-[#FFE135]" />
                    Token-Gated Previews
                </h4>
                <p className="mt-0.5 text-[10px] text-neutral-500">
                    Not available until the verification and protected-streaming backend is deployed.
                </p>
            </div>

            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6 text-center">
                <ServerOff size={28} className="mx-auto mb-3 text-yellow-300" />
                <p className="text-sm font-semibold text-white">No token gate can be published yet</p>
                <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-neutral-400">
                    A real launch must verify wallet ownership on the server, issue short-lived media access,
                    persist the gate configuration, and record only verified views. This app does not simulate
                    those steps or generate a share link.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[10px] text-neutral-500">
                    <Wallet size={12} /> Wallet connection alone does not prove durable access
                </div>
            </div>
        </div>
    );
}
