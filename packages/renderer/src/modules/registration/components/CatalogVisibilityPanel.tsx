import React, { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/services/firebase';
import { parseCatalogVisibilityState, type CatalogVisibilityState } from '../services/CatalogVisibilityState';

export function CatalogVisibilityPanel({ userId }: { userId: string }) {
    const [records, setRecords] = useState<CatalogVisibilityState[]>([]);
    const [loading, setLoading] = useState(true);
    const [readError, setReadError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [truncated, setTruncated] = useState(false);
    const [pending, setPending] = useState<string | null>(null);
    const [confirmPublic, setConfirmPublic] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) {
            setReadError('Sign in to view your catalog visibility.');
            setLoading(false);
            return;
        }
        return onSnapshot(query(collection(db, 'users', userId, 'master_admin'),
            where('lifecycle', 'in', ['ADMIN_LOCKED', 'DISTRIBUTION_READY']), limit(51)), snapshot => {
            try {
                const next = snapshot.docs.slice(0, 50).map(doc => parseCatalogVisibilityState(userId, doc.id, doc.data()));
                setRecords(next);
                setTruncated(snapshot.size > 50);
                setReadError(null);
            } catch {
                setRecords([]);
                setReadError('Catalog visibility data is unavailable because a record could not be verified.');
            }
            setLoading(false);
        }, () => {
            setRecords([]);
            setLoading(false);
            setReadError('Catalog visibility could not be loaded. Check your connection and sign-in.');
        });
    }, [userId]);

    async function changeVisibility(masterHash: string, visibility: 'private' | 'public') {
        if (pending) return;
        setPending(masterHash);
        setActionMessage(null);
        try {
            if (!functions) throw new Error('Catalog visibility is unavailable.');
            const change = httpsCallable<{ masterHash: string; visibility: 'private' | 'public' }, unknown>(functions, 'setCatalogVisibility');
            await change({ masterHash, visibility });
            setActionMessage('Visibility change saved. The catalog list shows the persisted status.');
            setConfirmPublic(null);
        } catch (error) {
            setActionMessage(error instanceof Error ? error.message : 'Catalog visibility could not be changed.');
        } finally {
            setPending(null);
        }
    }

    return <section className="p-6 overflow-auto space-y-4" aria-label="Catalog visibility">
        <h2 className="text-lg font-semibold text-white">Catalog visibility</h2>
        <p className="text-sm text-gray-400">Locked masters start private. Publishing makes their catalog metadata available publicly. The server checks the lock receipt and both rights streams before publication.</p>
        {loading && <p role="status">Loading catalog visibility…</p>}
        {readError && <p role="alert" className="text-red-400">{readError}</p>}
        {!loading && !readError && records.length === 0 && <p>No administratively locked masters are available here yet.</p>}
        {truncated && <p role="status">Showing the first 50 locked masters. This is a partial catalog view.</p>}
        {actionMessage && <p role="status" className="text-sm text-gray-300">{actionMessage}</p>}
        {!readError && records.map(record => <article key={record.masterHash} className="border border-white/10 rounded-lg p-4 space-y-3">
            <p className="text-sm break-all">Master {record.masterHash}</p>
            <p className="text-sm">Persisted visibility: <strong>{record.catalogVisibility}</strong></p>
            {confirmPublic === record.masterHash ? <div className="space-y-2">
                <p className="text-sm">Publish this master’s catalog metadata to public search and licensing consumers?</p>
                <button disabled={pending !== null} className="mr-3 text-green-400 disabled:opacity-50" onClick={() => void changeVisibility(record.masterHash, 'public')}>Confirm publication</button>
                <button disabled={pending !== null} onClick={() => setConfirmPublic(null)}>Cancel</button>
            </div> : <button disabled={pending !== null || loading} className="text-green-400 disabled:opacity-50" onClick={() => {
                if (record.catalogVisibility === 'public') void changeVisibility(record.masterHash, 'private');
                else setConfirmPublic(record.masterHash);
            }}>{pending === record.masterHash ? 'Saving…' : record.catalogVisibility === 'public' ? 'Make private' : 'Publish catalog metadata'}</button>}
        </article>)}
    </section>;
}
