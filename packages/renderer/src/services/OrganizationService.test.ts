
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationService } from './OrganizationService';

// Mock Firebase
vi.mock('./firebase', () => ({
  serverTimestamp: vi.fn(),
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
  serverTimestamp: vi.fn(),
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
            data: () => ({
  serverTimestamp: vi.fn(), members: ['user-123'] })
        });

        const orgId = await OrganizationService.createOrganization('Test Org', 'user-123');

        expect(mockAddDoc).toHaveBeenCalled();
        expect(orgId).toBe('new-org-id');
    });

    it('gets user organizations', async () => {
        mockGetDocs.mockResolvedValue({
            docs: [
                { id: 'org-1', data: () => ({
  serverTimestamp: vi.fn(), name: 'Org 1', members: ['user-123'] }) }
            ]
        });

        const orgs = await OrganizationService.getUserOrganizations('user-123');

        expect(mockQuery).toHaveBeenCalled();
        expect(mockWhere).toHaveBeenCalledWith('members', 'array-contains', 'user-123');
        expect(orgs.length).toBe(1);
        expect(orgs[0]!.id).toBe('org-1');
    });

    // ISSUE-772: the placeholder 'org-default' must never be used as a query scope —
    // Firestore rules reject org-scope reads for a nonexistent org, silently killing
    // cross-device history sync.
    describe('getCurrentOrgId (ISSUE-772 scoping)', () => {
        const makeStore = (state: Record<string, unknown>) => ({ getState: () => state });

        it('returns null when store is not initialized', () => {
            OrganizationService.setStore(null);
            expect(OrganizationService.getCurrentOrgId()).toBeNull();
        });

        it("resolves the 'org-default' placeholder to 'personal'", () => {
            OrganizationService.setStore(makeStore({ currentOrganizationId: 'org-default', organizations: [] }));
            expect(OrganizationService.getCurrentOrgId()).toBe('personal');
        });

        it("resolves an empty org id to 'personal'", () => {
            OrganizationService.setStore(makeStore({ currentOrganizationId: '', organizations: [] }));
            expect(OrganizationService.getCurrentOrgId()).toBe('personal');
        });

        it('returns a real org id when it exists in the loaded org list', () => {
            OrganizationService.setStore(makeStore({
                currentOrganizationId: 'org-abc',
                organizations: [{ id: 'org-abc' }]
            }));
            expect(OrganizationService.getCurrentOrgId()).toBe('org-abc');
        });

        it("falls back to 'personal' when the current id is stale (not in loaded orgs)", () => {
            OrganizationService.setStore(makeStore({
                currentOrganizationId: 'org-deleted',
                organizations: [{ id: 'org-other' }]
            }));
            expect(OrganizationService.getCurrentOrgId()).toBe('personal');
        });

        it('trusts the current id while orgs have not loaded yet (empty list)', () => {
            OrganizationService.setStore(makeStore({
                currentOrganizationId: 'org-abc',
                organizations: []
            }));
            expect(OrganizationService.getCurrentOrgId()).toBe('org-abc');
        });
    });
});
