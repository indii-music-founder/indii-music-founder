
import { Timestamp } from 'firebase/firestore';

export enum ContractStatus {
    DRAFT = 'draft',
    REVIEW = 'review',
    FINAL = 'final',
    SIGNED = 'signed'
}

export interface LegalContract {
    id: string;
    userId: string;
    title: string;
    type: string; // 'NDA', 'Split Sheet', 'License', etc.
    parties: string[];
    content: string; // Markdown content
    status: ContractStatus;
    createdAt: Timestamp | number;
    updatedAt: Timestamp | number;
    metadata?: Record<string, any>;
}
