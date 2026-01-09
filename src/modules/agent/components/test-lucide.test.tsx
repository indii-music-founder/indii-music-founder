import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MapPin } from 'lucide-react';

describe('lucide-react check', () => {
    it('imports MapPin correctly', () => {
        expect(MapPin).toBeDefined();
        render(<MapPin />);
    });
});
