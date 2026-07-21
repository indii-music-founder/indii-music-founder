import { createCallable } from 'react-call';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

export interface AddTaxCollaboratorResult {
    name: string;
    email: string;
    country: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AddTaxCollaboratorDialog = createCallable<Record<string, never>, AddTaxCollaboratorResult | null>(({ call }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [country, setCountry] = useState('US');
    const [error, setError] = useState<string | null>(null);

    function handleSubmit() {
        if (!name.trim()) {
            setError('Name is required.');
            return;
        }
        if (!EMAIL_PATTERN.test(email.trim())) {
            setError('Enter a valid email address.');
            return;
        }
        call.end({ name: name.trim(), email: email.trim(), country: country.trim() || 'US' });
    }

    return (
        <Modal isOpen={true} onClose={() => call.end(null)} titleId="add-tax-collaborator-title" maxWidth="max-w-md">
            <div className="p-6">
                <h2 id="add-tax-collaborator-title" className="text-xl font-bold text-white mb-4">Add Collaborator</h2>

                {error && (
                    <p className="text-xs text-red-400 mb-3" role="alert">{error}</p>
                )}

                <label htmlFor="tax-collab-name" className="block text-xs font-bold text-gray-400 mb-1">Name</label>
                <input
                    id="tax-collab-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    className="w-full bg-slate-800 border border-white/10 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-dept-creative mb-3"
                    placeholder="Jane Collaborator"
                />

                <label htmlFor="tax-collab-email" className="block text-xs font-bold text-gray-400 mb-1">Email</label>
                <input
                    id="tax-collab-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-dept-creative mb-3"
                    placeholder="jane@example.com"
                />

                <label htmlFor="tax-collab-country" className="block text-xs font-bold text-gray-400 mb-1">
                    Country <span className="font-normal text-gray-500">(US → W-9, otherwise → W-8BEN)</span>
                </label>
                <input
                    id="tax-collab-country"
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value.toUpperCase())}
                    maxLength={2}
                    className="w-full bg-slate-800 border border-white/10 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-dept-creative mb-6 uppercase"
                    placeholder="US"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSubmit();
                    }}
                />

                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => call.end(null)}>Cancel</Button>
                    <Button variant="default" onClick={handleSubmit}>Add</Button>
                </div>
            </div>
        </Modal>
    );
});
