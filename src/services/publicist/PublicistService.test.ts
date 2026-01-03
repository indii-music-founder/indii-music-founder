import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PublicistService } from './PublicistService';
import {
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    doc
} from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn(),
    addDoc: vi.fn(),
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDocs: vi.fn(),
    writeBatch: vi.fn()
}));

// Mock db instance
vi.mock('../firebase', () => ({
    db: {}
}));

describe('PublicistService', () => {
    const minUserId = 'user123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should be defined', () => {
        expect(PublicistService).toBeDefined();
    });


});
