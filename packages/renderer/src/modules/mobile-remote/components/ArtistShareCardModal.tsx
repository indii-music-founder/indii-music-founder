import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';
import { buildArtistShareCard } from './artistShareCard';

export default function ArtistShareCardModal({ name, email, onClose }: { name: string; email?: string; onClose: () => void }) {
    const [includeEmail, setIncludeEmail] = useState(false);
    const card = buildArtistShareCard(name, includeEmail ? email : undefined);
    return (
        <div role="dialog" aria-modal="true" aria-label="Share my artist card" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#1c1815] p-6 text-white shadow-2xl">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold">Share My Card</h2>
                    <button type="button" aria-label="Close artist card" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20"><X size={20} /></button>
                </div>
                <div className="mt-5 flex justify-center rounded-2xl bg-white p-4">
                    <QRCodeSVG value={card} size={240} level="M" title={`${name} contact card`} />
                </div>
                <p className="mt-4 text-center text-sm font-semibold">{name}</p>
                <p className="mt-1 text-center text-xs text-stone-400">Scan to add this vCard to Contacts.</p>
                {email && <label className="mt-5 flex min-h-11 items-center gap-3 text-xs text-stone-200">
                    <input type="checkbox" checked={includeEmail} onChange={event => setIncludeEmail(event.target.checked)} />
                    Include my account email on the shared card
                </label>}
            </div>
        </div>
    );
}
