import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ScheduledPost } from '@/modules/marketing/types';

vi.mock('@/modules/marketing/components/IntelligenceEnhancePostModal', () => ({
    default: ({ post, onApply, onClose }: { post: ScheduledPost; onApply: (id: string, copy: string) => void; onClose: () => void }) => (
        <div role="dialog" aria-label="Enhance social post">
            <span data-testid="enhance-source">{post.copy}</span>
            <button onClick={() => { onApply(post.id, 'Sharper copy'); onClose(); }}>Apply</button>
        </div>
    ),
}));

import EditableCopyModal from '@/modules/marketing/components/EditableCopyModal';

const post = { id: 'p1', day: 2, platform: 'Instagram', copy: 'Original copy', status: 'PENDING' } as unknown as ScheduledPost;

describe('EditableCopyModal', () => {
    it('improves the current draft with AI and returns the result to the editor without saving', () => {
        const onSave = vi.fn();
        render(<EditableCopyModal post={post} onClose={vi.fn()} onSave={onSave} />);

        fireEvent.change(screen.getByPlaceholderText('Write your post copy here...'), { target: { value: 'Edited draft' } });
        fireEvent.click(screen.getByRole('button', { name: /Improve with AI/ }));

        expect(screen.getByTestId('enhance-source')).toHaveTextContent('Edited draft');
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        expect(screen.getByPlaceholderText('Write your post copy here...')).toHaveValue('Sharper copy');
        expect(onSave).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
        expect(onSave).toHaveBeenCalledWith('p1', 'Sharper copy');
    });

    it('disables AI improvement for an empty draft', () => {
        render(<EditableCopyModal post={{ ...post, copy: '' }} onClose={vi.fn()} onSave={vi.fn()} />);
        expect(screen.getByRole('button', { name: /Improve with AI/ })).toBeDisabled();
    });
});
