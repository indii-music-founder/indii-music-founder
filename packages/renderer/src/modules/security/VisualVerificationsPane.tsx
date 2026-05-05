import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { ShieldAlert, ShieldCheck, Camera } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VisualVerificationRecord {
    id: string;
    traceId: string;
    passed: boolean;
    attemptNumber: number;
    score: {
        subjectMatch: number;
        sceneMatch: number;
        moodMatch: number;
        technicalAdherence: number;
        overallPass: boolean;
        gapsFound: string;
    } | null;
    createdAt: any;
}

export function VisualVerificationsPane() {
    const [records, setRecords] = useState<VisualVerificationRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            // Use Promise.resolve() to avoid synchronous setState in effect
            Promise.resolve().then(() => setLoading(false));
            return;
        }

        const q = query(
            collection(db, 'users', uid, 'visualVerifications'),
            orderBy('createdAt', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as VisualVerificationRecord[];
            setRecords(data);
            setLoading(false);
        }, (error) => {
            console.error("Failed to fetch visual verifications:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                <span className="animate-pulse">Loading audit logs...</span>
            </div>
        );
    }

    if (records.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <Camera size={32} className="mb-3 opacity-20" />
                <span className="font-bold uppercase tracking-widest text-[10px]">No Verification Logs</span>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {records.map((record) => (
                <div key={record.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-lg flex items-start gap-3">
                    <div className="mt-0.5">
                        {record.passed ? (
                            <ShieldCheck size={16} className="text-emerald-400" />
                        ) : (
                            <ShieldAlert size={16} className="text-amber-400" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-white truncate">
                                Trace: {record.traceId.slice(0, 8)}...
                            </span>
                            {record.createdAt?.toDate && (
                                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                    {formatDistanceToNow(record.createdAt.toDate(), { addSuffix: true })}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1">
                            <span className="px-1.5 py-0.5 rounded bg-white/5">
                                Attempt {record.attemptNumber}
                            </span>
                            {record.score && (
                                <>
                                    <span>Subject: {record.score.subjectMatch}/10</span>
                                    <span>Scene: {record.score.sceneMatch}/10</span>
                                </>
                            )}
                        </div>
                        {record.score && !record.passed && (
                            <p className="text-[10px] text-amber-400/80 line-clamp-2 mt-1 italic">
                                "{record.score.gapsFound}"
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
