
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationService } from './OrganizationService';

// Mock Firebase
vi.mock('./firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'user-123' }
    }
}));

// Mock Firestore
const mockAddDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: (...args: any[]) => mockCollection(...args),
    doc: vi.fn(),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    updateDoc: (...args: any[]) => mockUpdateDoc(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    query: (...args: any[]) => mockQuery(...args),
    where: (...args: any[]) => mockWhere(...args),
    Timestamp: { now: () => 1234567890 }
}));

describe('OrganizationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates an organization and adds user to it', async () => {
        mockAddDoc.mockResolvedValue({ id: 'new-org-id' });
        // Mock getDoc for addUserToOrg check
        mockGetDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({ members: ['user-123'] })
        });

        const orgId = await OrganizationService.createOrganization('Test Org', 'user-123');

        expect(mockAddDoc).toHaveBeenCalled();
        expect(orgId).toBe('new-org-id');
    });

    it('gets user organizations', async () => {
        mockGetDocs.mockResolvedValue({
            docs: [
                { id: 'org-1', data: () => ({ name: 'Org 1', members: ['user-123'] }) }
            ]
        });

        const orgs = await OrganizationService.getUserOrganizations('user-123');

        expect(mockQuery).toHaveBeenCalled();
        expect(mockWhere).toHaveBeenCalledWith('members', 'array-contains', 'user-123');
        expect(orgs.length).toBe(1);
        expect(orgs[0].id).toBe('org-1');
    });
});
