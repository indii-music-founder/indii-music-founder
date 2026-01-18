import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeChat } from './KnowledgeChat';
import { knowledgeBaseService } from '../services/KnowledgeBaseService';

// Mock the service
vi.mock('../services/KnowledgeBaseService', () => ({
    knowledgeBaseService: {
        chatStream: vi.fn(),
    }
}));

// Mock scrollIntoView/scrollTop since JSDOM doesn't handle layout
Element.prototype.scrollTo = vi.fn();

describe('👁️ Pixel: KnowledgeChat Stream Verification', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        activeDoc: {
            id: 'doc-1',
            title: 'Test Document.pdf',
            type: 'PDF',
            size: '1.2 MB',
            date: '2023-10-27',
            status: 'indexed',
            rawName: 'files/doc-1',
            mimeType: 'application/pdf'
        } as any
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when isOpen is false', () => {
        render(<KnowledgeChat {...defaultProps} isOpen={false} />);
        expect(screen.queryByText('Neural Chat')).not.toBeInTheDocument();
    });

    it('renders initial welcome message and active doc info', () => {
        render(<KnowledgeChat {...defaultProps} />);

        expect(screen.getByText('Neural Chat')).toBeInTheDocument();
        expect(screen.getByText('Focus: Test Document.pdf')).toBeInTheDocument();
        expect(screen.getByText(/Hello! I'm your Neural Knowledge Assistant/i)).toBeInTheDocument();
    });

    it('handles progressive streaming responses correctly', async () => {
        // Pixel's Favorite: Mocking a streaming response
        const mockStream = async function* () {
            yield "Analyzing";
            yield " the";
            yield " document...";
        };

        (knowledgeBaseService.chatStream as any).mockReturnValue(mockStream());

        render(<KnowledgeChat {...defaultProps} />);

        // Type and send message
        const input = screen.getByPlaceholderText(/Neural Analysis of/i);
        fireEvent.change(input, { target: { value: 'Explain quantum physics' } });
        fireEvent.click(screen.getByRole('button', { name: /send message/i }));

        // Verify "Initializing Neural Link..." appears immediately
        expect(screen.getByText('Explain quantum physics')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText(/Initializing Neural Link/i)).toBeInTheDocument();
        });

        // Verify intermediate stream states
        await waitFor(() => {
            expect(screen.getByText('Analyzing the document...')).toBeInTheDocument();
        });

        // After stream ends, it should be added to messages list and streaming indicator removed.
        await waitFor(() => {
            expect(screen.queryByText(/Initializing Neural Link/i)).not.toBeInTheDocument();
        });
    });

    it('handles streaming errors gracefully', async () => {
        // eslint-disable-next-line require-yield
        const mockErrorStream = async function* () {
            // eslint-disable-next-line no-constant-condition
            if (false) yield 'dummy';
            throw new Error("Neural Link Severed");
        };
        (knowledgeBaseService.chatStream as any).mockReturnValue(mockErrorStream());

        render(<KnowledgeChat {...defaultProps} />);

        const input = screen.getByPlaceholderText(/Neural Analysis of/i);
        fireEvent.change(input, { target: { value: 'Crash me' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => {
            expect(screen.getByText(/I apologize, but I encountered an error/i)).toBeInTheDocument();
        });
    });

    it('supports clicking suggested questions', async () => {
        (knowledgeBaseService.chatStream as any).mockReturnValue((async function* () { yield "Summary"; })());

        render(<KnowledgeChat {...defaultProps} />);

        const suggestion = screen.getByText('Summarize this document');
        fireEvent.click(suggestion);

        expect(screen.getByText('Summarize this document')).toBeInTheDocument();
        expect(knowledgeBaseService.chatStream).toHaveBeenCalledWith('Summarize this document', 'doc-1');

        await waitFor(() => {
             expect(screen.getByText('Summary')).toBeInTheDocument();
        });
    });

    it('clears chat history', async () => {
        render(<KnowledgeChat {...defaultProps} />);

        expect(screen.getByText(/Hello!/i)).toBeInTheDocument();

        const clearButton = screen.getByTitle('Clear Chat');
        fireEvent.click(clearButton);

        // Let's add a message first via interaction
        (knowledgeBaseService.chatStream as any).mockReturnValue((async function* () { yield "Response"; })());
        const input = screen.getByPlaceholderText(/Neural Analysis of/i);
        fireEvent.change(input, { target: { value: 'Temp Msg' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => screen.getByText('Temp Msg'));
        await waitFor(() => screen.getByText('Response'));

        // Now clear
        fireEvent.click(clearButton);

        expect(screen.queryByText('Temp Msg')).not.toBeInTheDocument();
        expect(screen.getByText(/Hello!/i)).toBeInTheDocument();
    });

    it('auto-scrolls to bottom as content streams', async () => {
        // 👁️ Pixel: Verify auto-scroll during streaming to prevent visual jitter

        let resolveNext: (() => void) | null = null;
        const mockStream = async function* () {
            yield "Chunk 1";
            // Pause stream to allow intermediate verification
            await new Promise<void>(r => { resolveNext = r; });
            yield "Chunk 2";
        };

        (knowledgeBaseService.chatStream as any).mockReturnValue(mockStream());

        render(<KnowledgeChat {...defaultProps} />);

        const input = screen.getByPlaceholderText(/Neural Analysis of/i);
        fireEvent.change(input, { target: { value: 'Scroll Test' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        // 1. Verify First Chunk
        await waitFor(() => expect(screen.getByText('Chunk 1')).toBeInTheDocument());

        // Find scroll container
        // We use closest('.overflow-y-auto') as a stable structural selector
        const scrollContainer = screen.getByText('Chunk 1').closest('.overflow-y-auto') as HTMLElement;
        expect(scrollContainer).toBeTruthy();

        // 2. Mock layout property 'scrollHeight'
        // In JSDOM, this is 0 by default. We set it to simulate content growth.
        Object.defineProperty(scrollContainer, 'scrollHeight', { value: 500, configurable: true });

        // 3. Release next chunk
        act(() => {
            if (resolveNext) resolveNext();
        });

        // 4. Verify Second Chunk & Auto-Scroll
        // Content should now be concatenated
        await waitFor(() => expect(screen.getByText('Chunk 1Chunk 2')).toBeInTheDocument());

        // The component's useEffect should have run after the update, reading the
        // mocked scrollHeight (500) and setting scrollTop to it.
        expect(scrollContainer.scrollTop).toBe(500);

        // Clean up - use type assertion because TS loses track of variable type after async operations
        (resolveNext as (() => void) | null)?.();
    });
});
