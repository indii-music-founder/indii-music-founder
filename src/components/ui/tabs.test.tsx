import React from 'react';
import { render, screen } from '@testing-library/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
import { describe, it, expect } from 'vitest';

describe('Tabs Component', () => {
    it('renders with correct accessibility roles', () => {
        render(
            <Tabs defaultValue="tab1">
                <TabsList>
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content 1</TabsContent>
                <TabsContent value="tab2">Content 2</TabsContent>
            </Tabs>
        );

        // Check Roles
        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeInTheDocument();
        expect(screen.getByRole('tabpanel')).toBeInTheDocument();

        // Check ARIA Attributes
        const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
        const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
        const panel1 = screen.getByRole('tabpanel');

        // Selected state
        expect(tab1).toHaveAttribute('aria-selected', 'true');
        expect(tab2).toHaveAttribute('aria-selected', 'false');

        // ID linking (ARIA Controls / LabelledBy)
        const tab1Controls = tab1.getAttribute('aria-controls');
        const panel1Id = panel1.getAttribute('id');
        expect(tab1Controls).toBe(panel1Id);

        const panel1LabelledBy = panel1.getAttribute('aria-labelledby');
        const tab1Id = tab1.getAttribute('id');
        expect(panel1LabelledBy).toBe(tab1Id);
    });
});
