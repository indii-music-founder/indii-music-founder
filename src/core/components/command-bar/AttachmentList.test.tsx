import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentList } from './AttachmentList';
import { vi } from 'vitest';

// Mock Lucide icons to avoid rendering issues
vi.mock('lucide-react', () => ({
  Image: () => <span data-testid="icon-image" />,
  Paperclip: () => <span data-testid="icon-paperclip" />,
  X: () => <span data-testid="icon-x" />,
}));

describe('AttachmentList', () => {
  const mockFile1 = new File(['content'], 'test-image.png', { type: 'image/png' });
  const mockFile2 = new File(['content'], 'document.pdf', { type: 'application/pdf' });
  const mockAttachments = [mockFile1, mockFile2];
  const mockOnRemove = vi.fn();

  it('renders nothing when there are no attachments', () => {
    const { container } = render(<AttachmentList attachments={[]} onRemove={mockOnRemove} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a semantic list of attachments', () => {
    render(<AttachmentList attachments={mockAttachments} onRemove={mockOnRemove} />);

    // This expects a <ul> or <ol>
    const list = screen.getByRole('list', { name: /attached files/i });
    expect(list).toBeInTheDocument();

    // Expect list items
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('renders correct icons and filenames', () => {
    render(<AttachmentList attachments={mockAttachments} onRemove={mockOnRemove} />);

    expect(screen.getByText('test-image.png')).toBeInTheDocument();
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('icon-image')).toBeInTheDocument();
    expect(screen.getByTestId('icon-paperclip')).toBeInTheDocument();
  });

  it('calls onRemove when remove button is clicked', () => {
    render(<AttachmentList attachments={mockAttachments} onRemove={mockOnRemove} />);

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);

    expect(mockOnRemove).toHaveBeenCalledWith(0);
  });
});
