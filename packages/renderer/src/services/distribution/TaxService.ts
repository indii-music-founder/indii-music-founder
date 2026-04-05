import { FirestoreService } from '@/services/FirestoreService';
import { TaxProfileDocument } from '@/types/firestore';

class TaxService extends FirestoreService<TaxProfileDocument> {
    constructor() {
        super('tax_profiles');
    }

    /**
     * Get tax profile for a specific user
     */
    async getProfile(userId: string): Promise<TaxProfileDocument | null> {
        // We use set for 'userId' as the document ID usually, or we can query.
        // For tax profiles, using userId as the ID is common if there's only one per user.
        // However, FirestoreService.get uses the doc ID.
        // Let's stick to query for flexibility or use get if we enforce ID = userId.
        // Given firestore.rules usually anchor on ID if it's a profile, let's check rules later.
        // For now, consistent with other profiles in the app:
        return this.get(userId);
    }

    /**
     * Update or create tax profile
     */
    async saveProfile(userId: string, data: Omit<TaxProfileDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
        // Safe cast: FirestoreService.set uses { merge: true }, so missing id/createdAt/updatedAt
        // fields are not overwritten. The Omit type guarantees we only pass data fields.
        await this.set(userId, data as unknown as TaxProfileDocument);
    }
}

export const taxService = new TaxService();
