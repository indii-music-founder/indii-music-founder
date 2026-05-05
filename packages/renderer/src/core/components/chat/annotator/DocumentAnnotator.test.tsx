/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocumentAnnotator } from './DocumentAnnotator';
import { AgentService } from '@/services/agent/AgentService';

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => {
    return {
        GlobalWorkerOptions: { workerSrc: '' },
        version: '2.16.105',
        getDocument: vi.fn().mockReturnValue({
            promise: Promise.resolve({
                numPages: 3,
                getPage: vi.fn().mockResolvedValue({
                    getViewport: vi.fn().mockReturnValue({ width: 800, height: 1000 }),
                    render: vi.fn().mockReturnValue({ promise: Promise.resolve() })
                })
            })
        })
    };
});

// Mock HTMLCanvasElement context since we render canvas
beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
    }) as any;
});

afterEach(() => {
    cleanup();
});

describe('DocumentAnnotator', () => {
    const defaultProps = {
        documentUrl: 'http://example.com/test.pdf',
        documentId: 'doc-123',
        originalMessageId: 'msg-123',
        agentId: 'agent-123'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the document annotator with controls', () => {
        render(<DocumentAnnotator {...defaultProps} />);
        
        expect(screen.getByText(/Document Annotator/i)).toBeInTheDocument();
        expect(screen.getByTitle('Highlight Area')).toBeInTheDocument();
        expect(screen.getByTitle('Add Sticky Note')).toBeInTheDocument();
        expect(screen.getByTitle('Eraser')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Apply Document Edits/i })).toBeInTheDocument();
    });

    it('should handle pagination', async () => {
        render(<DocumentAnnotator {...defaultProps} />);
        
        // Wait for PDF to load and pagination to show " / 3"
        await waitFor(() => {
            const pageText = screen.getByText((content, element) => content.includes('/ 3'));
            expect(pageText).toBeInTheDocument();
        });

        // Current page is 1
        expect(screen.getByText('1')).toBeInTheDocument();

        // Click next page
        const nextButton = screen.getAllByRole('button').find(b => b.innerHTML.includes('ChevronRight'));
        if (nextButton) fireEvent.click(nextButton);
        
        await waitFor(() => {
            expect(screen.getByText('2')).toBeInTheDocument();
        });
    });

    it('should disable Apply button when no annotations and no global instruction', () => {
        render(<DocumentAnnotator {...defaultProps} />);
        
        const applyBtn = screen.getByRole('button', { name: /Apply Document Edits/i });
        expect(applyBtn).toHaveProperty('disabled', true);
        
        // Add global instruction
        const textarea = screen.getByPlaceholderText(/Global instructions for this document edit/i);
        fireEvent.change(textarea, { target: { value: 'Fix typos' } });
        
        expect(applyBtn).toHaveProperty('disabled', false);
    });

    it('should dispatch tool call on apply', async () => {
        const spy = vi.spyOn(AgentService.prototype, 'dispatchToolCall').mockResolvedValue({} as any);

        render(<DocumentAnnotator {...defaultProps} />);
        
        // Add global instruction to enable button
        const textarea = screen.getByPlaceholderText(/Global instructions for this document edit/i);
        fireEvent.change(textarea, { target: { value: 'Fix typos' } });
        
        const applyBtn = screen.getByRole('button', { name: /Apply Document Edits/i });
        fireEvent.click(applyBtn);
        
        await waitFor(() => {
            expect(spy).toHaveBeenCalledWith(
                'agent-123',
                'edit_document_with_annotations',
                expect.objectContaining({
                    documentId: 'doc-123',
                    globalInstruction: 'Fix typos',
                    annotations: []
                }),
                'msg-123'
            );
        });
    });
});
