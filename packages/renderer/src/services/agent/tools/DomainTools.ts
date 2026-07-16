import { db, auth } from '@/services/firebase';
import { collection, query, where, getDocs, limit as fsLimit } from 'firebase/firestore';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { useStore } from '@/core/store';

export type CollectionConfig = {
    path: string; // e.g. 'expenses', 'users/{uid}/ledger', etc.
    requiresUserIdFilter: boolean; // if true and path doesn't contain {uid}, it adds where('userId', '==', uid)
};

export const buildDomainRetrievalTools = (
    domainName: string,
    collections: Record<string, CollectionConfig>
): Record<string, AnyToolFunction> => {
    return {
        list_domain_records: wrapTool('list_domain_records', async (args: { collectionName: string, limit?: number }) => {
            const config = collections[args.collectionName];
            if (!config) {
                return toolError(
                    `Access Denied: The ${domainName} agent is not authorized to read from collection '${args.collectionName}'. Use consult_specialist to request this data from the owning agent.`,
                    'PERMISSION_DENIED'
                );
            }

            const state = useStore.getState();
            const userId = state.userProfile?.id || auth.currentUser?.uid;

            if (!userId) {
                return toolError('User profile not found. Must be authenticated to list records.', 'UNAUTHENTICATED');
            }

            try {
                let queryRef;
                let actualPath = config.path;

                // Handle nested subcollections
                if (actualPath.includes('{uid}')) {
                    actualPath = actualPath.replace('{uid}', userId);
                    queryRef = query(collection(db, actualPath), fsLimit(args.limit || 20));
                } else if (config.requiresUserIdFilter) {
                    queryRef = query(collection(db, actualPath), where('userId', '==', userId), fsLimit(args.limit || 20));
                } else {
                    queryRef = query(collection(db, actualPath), fsLimit(args.limit || 20));
                }

                const snapshot = await getDocs(queryRef);
                const records = snapshot.docs.map(doc => {
                    const data = doc.data() as Record<string, any>;
                    // Clean up timestamps for the model
                    for (const key in data) {
                        if (data[key] && typeof data[key].toDate === 'function') {
                            data[key] = data[key].toDate().toISOString();
                        }
                    }
                    return { id: doc.id, ...data };
                });

                const message = records.length > 0
                    ? `Found ${records.length} records in ${args.collectionName}.`
                    : `No records found in ${args.collectionName}.`;

                return toolSuccess({ records, count: records.length }, message);
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                return toolError(`Failed to list records: ${errorMessage}`, 'TOOL_EXECUTION_ERROR');
            }
        })
    };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const buildDomainRetrievalDeclarations = (domainName: string, collections: Record<string, CollectionConfig>): any[] => {
    const allowedCollections = Object.keys(collections);
    if (allowedCollections.length === 0) return [];
    
    return [
        {
            name: "list_domain_records",
            description: `List existing records from the ${domainName} domain. Use this whenever the user asks to see, pull up, or find existing data. Do NOT confabulate records.`,
            parameters: {
                type: "OBJECT",
                properties: {
                    collectionName: {
                        type: "STRING",
                        enum: allowedCollections,
                        description: `The collection to read from.`
                    },
                    limit: { type: "NUMBER", description: "Max number of records to return (default 20)" }
                },
                required: ["collectionName"]
            }
        }
    ];
};
