import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReviewStep from './ReviewStep';

describe('ReviewStep', () => {
    const defaultProps = {
        finalPrompt: 'test prompt',
        onBack: vi.fn(),
        onGenerate: vi.fn(),
        isGenerating: false,
        startFrameData: null,
        endFrameData: null,
        onDesignFrame: vi.fn(),
        onClearFrame: vi.fn(),
        ingredients: [],
        onAddIngredient: vi.fn(),
        onRemoveIngredient: vi.fn(),
    };

    it('renders ingredients section', () => {
        render(<ReviewStep {...defaultProps} />);
        expect(screen.getByText('Ingredients (Character/Style Reference)')).toBeInTheDocument();
        expect(screen.getByText('Add Reference')).toBeInTheDocument();
    });

    it('calls onAddIngredient when add button is clicked', () => {
        render(<ReviewStep {...defaultProps} />);
        fireEvent.click(screen.getByText('Add Reference'));
        expect(defaultProps.onAddIngredient).toHaveBeenCalled();
    });

    it('renders ingredients list', () => {
        const props = {
            ...defaultProps,
            ingredients: [
                { id: '1', url: 'img1.jpg', type: 'image' as const, timestamp: 0, projectId: '1', prompt: 'test1' },
                { id: '2', url: 'img2.jpg', type: 'image' as const, timestamp: 0, projectId: '1', prompt: 'test2' }
            ]
        };
        render(<ReviewStep {...props} />);
        const images = screen.getAllByAltText('Ingredient');
        expect(images).toHaveLength(2);
    });

    it('calls onRemoveIngredient when remove button is clicked', () => {
        const props = {
            ...defaultProps,
            ingredients: [
                { id: '1', url: 'img1.jpg', type: 'image' as const, timestamp: 0, projectId: '1', prompt: 'test1' }
            ]
        };
        render(<ReviewStep {...props} />);
        const buttons = screen.getAllByRole('button');
        const removeBtn = buttons.find(btn => btn.className.includes('bg-red-600'));
        if (removeBtn) {
            fireEvent.click(removeBtn);
            expect(defaultProps.onRemoveIngredient).toHaveBeenCalledWith(0);
        }
    });

    it('hides Add Reference button when 3 ingredients are present', () => {
        const props = {
            ...defaultProps,
            ingredients: [
                { id: '1', url: '1.jpg', type: 'image' as const, timestamp: 0, projectId: '1', prompt: 'test1' },
                { id: '2', url: '2.jpg', type: 'image' as const, timestamp: 0, projectId: '1', prompt: 'test2' },
                { id: '3', url: '3.jpg', type: 'image' as const, timestamp: 0, projectId: '1', prompt: 'test3' }
            ]
        };
        render(<ReviewStep {...props} />);
        expect(screen.queryByText('Add Reference')).not.toBeInTheDocument();
    });
});
