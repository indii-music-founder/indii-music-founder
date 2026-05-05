import { describe, it, expect } from 'vitest';
import { EditDocumentWithAnnotationsTool } from './EditDocumentWithAnnotationsTool';

describe('EditDocumentWithAnnotationsTool', () => {
    it('should have the correct tool name and description', () => {
        expect(EditDocumentWithAnnotationsTool.name).toBe('edit_document_with_annotations');
        expect(EditDocumentWithAnnotationsTool.description).toContain('Edit a document (PDF/Text)');
    });

    it('should successfully execute and format the spatial prompt', async () => {
        const mockArgs = {
            documentId: 'doc-123',
            globalInstruction: 'Make it sound professional',
            annotations: [
                { pageNumber: 1, type: 'highlight', x: 10, y: 20, width: 100, height: 50, color: 'yellow', content: 'Rewrite this' },
                { pageNumber: 2, type: 'sticky_note', x: 50, y: 60, color: 'blue', content: 'Add a summary here' }
            ]
        };

        const result = await EditDocumentWithAnnotationsTool.execute(mockArgs);

        expect(result.success).toBe(true);
        expect(result.newDocumentId).toContain('edited-doc-123-');
        expect(result.spatialPromptContext).toContain('Spatial Document Edit Request for ID: doc-123');
        expect(result.spatialPromptContext).toContain('Global Instruction: Make it sound professional');
        expect(result.spatialPromptContext).toContain('[PAGE 1 - HIGHLIGHT 1]: (x: 10, y: 20, w: 100, h: 50) -> "Rewrite this"');
        expect(result.spatialPromptContext).toContain('[PAGE 2 - STICKY NOTE 2]: (x: 50, y: 60) -> "Add a summary here"');
    });

    it('should execute without optional global instruction and content', async () => {
        const mockArgs = {
            documentId: 'doc-456',
            annotations: [
                { pageNumber: 1, type: 'highlight', x: 10, y: 20, width: 100, height: 50, color: 'yellow' }
            ]
        };

        const result = await EditDocumentWithAnnotationsTool.execute(mockArgs);

        expect(result.success).toBe(true);
        expect(result.spatialPromptContext).not.toContain('Global Instruction:');
        expect(result.spatialPromptContext).toContain('[PAGE 1 - HIGHLIGHT 1]: (x: 10, y: 20, w: 100, h: 50)');
    });
});
