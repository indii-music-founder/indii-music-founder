import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from './ProjectService';
import { getDocs, orderBy } from 'firebase/firestore';

// Mock Firebase
vi.mock('./firebase', () => ({
    db: {},
    auth: {}
}));

// Mock Firestore
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockAddDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: (...args: any[]) => mockCollection(...args),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    query: (...args: any[]) => mockQuery(...args),
    orderBy: (...args: any[]) => mockOrderBy(...args),
    where: (...args: any[]) => mockWhere(...args),
    doc: vi.fn(),
    getDoc: vi.fn()
}));

// Mock OrganizationService
vi.mock('./OrganizationService', () => ({
    OrganizationService: {
        getCurrentOrgId: () => 'org-123'
    }
}));

describe('ProjectService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('gets projects for org with server-side sorting', async () => {
        // Mock query snapshot
        mockGetDocs.mockResolvedValue({
            docs: [
                {
                    id: '1',
                    data: () => ({ name: 'Project 1', date: 1000, orgId: 'org-123' })
                },
                {
                    id: '2',
                    data: () => ({ name: 'Project 2', date: 2000, orgId: 'org-123' })
                }
            ]
        });

        const projects = await ProjectService.getProjectsForOrg('org-123');

        // Verify result is sorted by date descending (2000 > 1000)
        expect(projects[0].id).toBe('2');
        expect(projects[1].id).toBe('1');

        // Verify query construction (orderBy is NOT called on server in new impl)
        expect(mockQuery).toHaveBeenCalled();
        expect(mockWhere).toHaveBeenCalledWith('orgId', '==', 'org-123');
    });
});
