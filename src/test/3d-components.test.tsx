import React from 'react';
import { render } from '@testing-library/react';
import { describe, it } from 'vitest';
import { ThreeDCard, ThreeDCardContainer, ThreeDCardBody, ThreeDCardItem } from '../components/ui/ThreeDCard';
import { ThreeDButton } from '../components/ui/ThreeDButton';

describe('3D Components', () => {
    it('renders ThreeDCard without crashing', () => {
        render(
            <ThreeDCard>
                <div>Test Content</div>
            </ThreeDCard>
        );
    });

    it('renders ThreeDCardContainer/Body/Item without crashing', () => {
        render(
            <ThreeDCardContainer>
                <ThreeDCardBody>
                    <ThreeDCardItem>
                        <div>Test Item</div>
                    </ThreeDCardItem>
                </ThreeDCardBody>
            </ThreeDCardContainer>
        );
    });

    it('renders ThreeDButton without crashing', () => {
        render(
            <ThreeDButton>
                Click Me
            </ThreeDButton>
        );
    });
});
