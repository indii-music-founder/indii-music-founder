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
        // Note: The code sets isTyping=true immediately.
        expect(screen.getByText('Explain quantum physics')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText(/Initializing Neural Link/i)).toBeInTheDocument();
        });

        // Verify intermediate stream states (flaky in JSDOM? let's wait for final)
        // The component updates `streamingContent` state.

        await waitFor(() => {
            expect(screen.getByText('Analyzing the document...')).toBeInTheDocument();
        });

        // After stream ends, it should be added to messages list and streaming indicator removed.
        // The component logic: for await loop finishes -> adds botMsg -> isTyping=false.

        await waitFor(() => {
            expect(screen.queryByText(/Initializing Neural Link/i)).not.toBeInTheDocument();
        });

        // Final message check
        const messages = screen.getAllByText('Analyzing the document...');
        expect(messages.length).toBeGreaterThan(0); // Could be in streaming div (if lingering) or message list.
        // Actually, once finished, it moves to 'messages' array.
    });

    it('handles streaming errors gracefully', async () => {
        const mockErrorStream = async function* () {
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

        expect(screen.getByText('Summarize this document')).toBeInTheDocument(); // Appears as user message
        expect(knowledgeBaseService.chatStream).toHaveBeenCalledWith('Summarize this document', 'doc-1');

        // Wait for stream to finish to avoid act() warnings
        await waitFor(() => {
             expect(screen.getByText('Summary')).toBeInTheDocument();
        });
    });

    it('clears chat history', async () => {
        render(<KnowledgeChat {...defaultProps} />);

        // Add a message first (simulated by state update or just assuming welcome is there)
        expect(screen.getByText(/Hello!/i)).toBeInTheDocument();

        const clearButton = screen.getByTitle('Clear Chat');
        fireEvent.click(clearButton);

        // Should reset to empty, then useEffect adds welcome back.
        // So visually it might look same, but let's check if we had other messages.

        // Let's add a message first via interaction
        (knowledgeBaseService.chatStream as any).mockReturnValue((async function* () { yield "Response"; })());
        const input = screen.getByPlaceholderText(/Neural Analysis of/i);
        fireEvent.change(input, { target: { value: 'Temp Msg' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => screen.getByText('Temp Msg'));
        // Wait for AI response to finish to avoid act warnings
        await waitFor(() => screen.getByText('Response'));

        // Now clear
        fireEvent.click(clearButton);

        expect(screen.queryByText('Temp Msg')).not.toBeInTheDocument();
        expect(screen.getByText(/Hello!/i)).toBeInTheDocument(); // Welcome comes back
    });
});
