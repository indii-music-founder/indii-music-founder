import { FanRecord, EnrichedFanData, EnrichmentProvider, EnrichmentProgress } from '../../modules/marketing/types';
import { httpsCallable } from 'firebase/functions';
import { functionsWest1 } from '../firebase';
import { logger } from '@/utils/logger';

/**
 * FanEnrichmentService - Orchestrates demographic and interest data enrichment for fan lists.
 * 
 * Interacts with external providers (Clearbit, Apollo) via Cloud Functions
 * to provide a high-fidelity view of the fan base, enabling hyper-targeted marketing.
 */
export class FanEnrichmentService {
    /**
     * Parse CSV file into FanRecords
     * Handles basic mapping for common column names.
     */
    async parseCSV(file: File): Promise<FanRecord[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result as string;
                    if (!text) {
                        resolve([]);
                        return;
                    }

                    // Simple CSV parser (newline and comma)
                    const lines = text.split(/\r?\n/).filter(line => line.trim());
                    if (lines.length < 2) {
                        resolve([]);
                        return;
                    }

                    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]+/g, ''));

                    const records: FanRecord[] = [];
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',').map(v => v.trim().replace(/['"]+/g, ''));
                        if (values.length < headers.length) continue;

                        const record: any = {};
                        headers.forEach((header, index) => {
                            record[header] = values[index];
                        });

                        // Attempt to map common fields
                        const email = record.email || record['email address'] || record['mail'];
                        if (email && email.includes('@')) {
                            records.push({
                                email,
                                firstName: record.name?.split(' ')[0] || record.firstname || record.first_name || record['first name'],
                                lastName: record.name?.split(' ').slice(1).join(' ') || record.lastname || record.last_name || record['last name'],
                                city: record.city || record.location || record.town,
                                country: record.country || record['country code'],
                                phone: record.phone || record.mobile || record['phone number']
                            });
                        }
                    }
                    resolve(records);
                } catch (err) {
                    reject(new Error("Malformed CSV structure"));
                }
            };
            reader.onerror = () => reject(new Error("Failed to read CSV file"));
            reader.readAsText(file);
        });
    }

    /**
     * Enrich fans via Cloud Function
     * Processes in batches to ensure UI responsiveness and stay within function limits.
     */
    async enrichFans(
        fans: FanRecord[],
        provider: EnrichmentProvider,
        onProgress?: (progress: EnrichmentProgress) => void
    ): Promise<EnrichedFanData[]> {
        const enrichFn = httpsCallable(functionsWest1, 'enrichFanData');
        const results: EnrichedFanData[] = [];
        const total = fans.length;

        // Process in batches of 25 to avoid timeouts and show meaningful progress
        const batchSize = 25;

        for (let i = 0; i < fans.length; i += batchSize) {
            const batch = fans.slice(i, i + batchSize);

            if (onProgress) {
                onProgress({
                    processed: i,
                    total,
                    currentEmail: batch[0].email,
                    status: 'processing'
                });
            }

            try {
                const { useStore } = await import('@/core/store');
                const orgId = useStore.getState().currentOrganizationId;

                const response = await enrichFn({
                    fans: batch,
                    provider,
                    orgId
                });

                const enrichedBatch = (response.data as any).results as EnrichedFanData[];
                results.push(...enrichedBatch);
            } catch (error: any) {
                logger.error(`[FanEnrichment] Batch ${i} failed:`, error);

                // Fallback: Add placeholder data for failed enrichments so the UI doesn't lose the record
                const fallback = batch.map(f => ({
                    ...f,
                    location: 'Unknown',
                    ageRange: 'Unknown',
                    incomeBracket: 'Unknown',
                    topGenre: 'Unknown',
                    lastEnriched: new Date().toISOString()
                }));
                results.push(...fallback);
            }
        }

        if (onProgress) {
            onProgress({
                processed: total,
                total,
                status: 'completed'
            });
        }

        return results;
    }
}

export const FanEnrichment = new FanEnrichmentService();
