import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as fabric from 'fabric';
import { useAutoSave } from './useAutoSave';
import { useStore } from '@/core/store';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    setDoc: vi.fn(),
    serverTimestamp: vi.fn(() => ({ _type: 'timestamp' }))
}));

// Mock Zustand store
vi.mock('@/core/store', () => ({
    useStore: vi.fn()
}));

describe('useAutoSave', () => {
    let mockCanvas: fabric.Canvas;
    let mockUser: any;
    let mockOrg: any;

    beforeEach(() => {
        // Create mock canvas
        const canvasEl = document.createElement('canvas');
        mockCanvas = new fabric.Canvas(canvasEl);

        // Mock user
        mockUser = {
            uid: 'test-user-123',
            email: 'test@example.com'
        };

        // Mock organization
        mockOrg = {
            id: 'org-test-123',
            name: 'Test Org',
            plan: 'pro' as const,
            members: ['test-user-123']
        };

        // Mock store to return correct properties
        vi.mocked(useStore).mockReturnValue({
            user: mockUser,
            currentOrganizationId: mockOrg.id,
            organizations: [mockOrg],
            currentProjectId: 'project-test-123'
        } as any);
    });

    afterEach(() => {
        vi.clearAllMocks();
        mockCanvas.dispose();
    });

    it('should initialize with null lastSaved', () => {
        const { result } = renderHook(() =>
            useAutoSave(mockCanvas, 'Test Design', 'design-123')
        );

        expect(result.current.lastSaved).toBeNull();
        expect(result.current.isSaving).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('should derive activeOrg from organizations array', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const { result } = renderHook(() =>
            useAutoSave(mockCanvas, 'Test Design', 'design-123', { enabled: false })
        );

        // Manually trigger save to check if activeOrg is properly derived
        result.current.saveDesign();

        // Should not warn about missing org since it should be derived correctly
        expect(consoleWarnSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('Auto-save skipped'),
            expect.objectContaining({ hasOrg: false })
        );

        consoleWarnSpy.mockRestore();
    });

    it('should skip save when canvas is null', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const { result } = renderHook(() =>
            useAutoSave(null, 'Test Design', 'design-123', { enabled: false })
        );

        await result.current.saveDesign();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Auto-save skipped'),
            expect.objectContaining({ hasCanvas: false })
        );

        consoleWarnSpy.mockRestore();
    });

    it('should skip save when user is null', async () => {
        vi.mocked(useStore).mockReturnValue({
            user: null,
            currentOrganizationId: mockOrg.id,
            organizations: [mockOrg],
            currentProjectId: 'project-test-123'
        } as any);

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const { result } = renderHook(() =>
            useAutoSave(mockCanvas, 'Test Design', 'design-123', { enabled: false })
        );

        await result.current.saveDesign();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Auto-save skipped'),
            expect.objectContaining({ hasUser: false })
        );

        consoleWarnSpy.mockRestore();
    });

    it('should skip save when currentProjectId is empty', async () => {
        vi.mocked(useStore).mockReturnValue({
            user: mockUser,
            currentOrganizationId: mockOrg.id,
            organizations: [mockOrg],
            currentProjectId: ''
        } as any);

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const { result } = renderHook(() =>
            useAutoSave(mockCanvas, 'Test Design', 'design-123', { enabled: false })
        );

        await result.current.saveDesign();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Auto-save skipped'),
            expect.objectContaining({ hasProject: false })
        );

        consoleWarnSpy.mockRestore();
    });

    it('should skip save when activeOrg cannot be derived', async () => {
        // Mock store with mismatched org ID
        vi.mocked(useStore).mockReturnValue({
            user: mockUser,
            currentOrganizationId: 'org-nonexistent',
            organizations: [mockOrg], // Different org ID
            currentProjectId: 'project-test-123'
        } as any);

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const { result } = renderHook(() =>
            useAutoSave(mockCanvas, 'Test Design', 'design-123', { enabled: false })
        );

        await result.current.saveDesign();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Auto-save skipped'),
            expect.objectContaining({
                hasOrg: false,
                currentOrganizationId: 'org-nonexistent'
            })
        );

        consoleWarnSpy.mockRestore();
    });

    it('should serialize canvas and save to Firestore', async () => {
        const { doc: mockDoc, setDoc: mockSetDoc } = await import('firebase/firestore');
        vi.mocked(mockSetDoc).mockResolvedValue(undefined);

        const { result } = renderHook(() =>
            useAutoSave(mockCanvas, 'Test Design', 'design-123', { enabled: false })
        );

        // Add object to canvas so it has content
        const rect = new fabric.Rect({ width: 100, height: 100 });
        mockCanvas.add(rect);

        await result.current.saveDesign();

        // Wait for save to complete
        await waitFor(() => {
            expect(result.current.isSaving).toBe(false);
        });

        expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'designs', 'design-123');
        expect(mockSetDoc).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                id: 'design-123',
                userId: mockUser.uid,
                orgId: mockOrg.id,
                projectId: 'project-test-123',
                name: 'Test Design',
                canvasJSON: expect.any(String),
                thumbnail: expect.any(String),
                lastModified: expect.objectContaining({ _type: 'timestamp' })
            }),
            { merge: true }
        );

        expect(result.current.lastSaved).toBeInstanceOf(Date);
        expect(result.current.error).toBeNull();
    });

    it('should include createdAt only on first save', async () => {
        const { setDoc: mockSetDoc } = await import('firebase/firestore');
        vi.mocked(mockSetDoc).mockResolvedValue(undefined);

        const { result } = renderHook(() =>
            useAutoSave(mockCanvas, 'Test Design', 'design-123', { enabled: false })
        );

        // First save
        await result.current.saveDesign();
        await waitFor(() => expect(result.current.isSaving).toBe(false));

        const firstSaveCall = vi.mocked(mockSetDoc).mock.calls[0][1];
        expect(firstSaveCall).toHaveProperty('createdAt');

        // Second save
        await result.current.saveDesign();
        await waitFor(() => expect(result.current.isSaving).toBe(false));

        const secondSaveCall = vi.mocked(mockSetDoc).mock.calls[1][1] as any;
        expect(secondSaveCall.createdAt).toBeUndefined();
    });

    it('should handle save errors gracefully', async () => {
        const { setDoc: mockSetDoc } = await import('firebase/firestore');
        const errorMessage = 'Network error';
        vi.mocked(mockSetDoc).mockRejectedValue(new Error(errorMessage));

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        const { result } = renderHook(() =>
            useAutoSave(mockCanvas, 'Test Design', 'design-123', { enabled: false })
        );

        await result.current.saveDesign();

        await waitFor(() => {
            expect(result.current.error).toBe(errorMessage);
            expect(result.current.isSaving).toBe(false);
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith('Auto-save failed:', expect.any(Error));

        consoleErrorSpy.mockRestore();
    });

    it('should log successful saves with timestamp', async () => {
        const { setDoc: mockSetDoc } = await import('firebase/firestore');
        vi.mocked(mockSetDoc).mockResolvedValue(undefined);

        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

        const { result } = renderHook(() =>
            useAutoSave(mockCanvas, 'Test Design', 'design-123', { enabled: false })
        );

        await result.current.saveDesign();

        await waitFor(() => {
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Design "Test Design" auto-saved at')
            );
        });

        consoleLogSpy.mockRestore();
    });
});
