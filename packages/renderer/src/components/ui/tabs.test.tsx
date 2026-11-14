import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
    it('skips hidden triggers and triggers inside hidden wrappers', () => {
        render(
            <Tabs defaultValue="first">
                <TabsList>
                    <TabsTrigger value="first">First</TabsTrigger>
                    <TabsTrigger hidden value="hidden">Hidden</TabsTrigger>
                    <div hidden><TabsTrigger value="wrapped">Wrapped</TabsTrigger></div>
                    <TabsTrigger value="last">Last</TabsTrigger>
                </TabsList>
            </Tabs>,
        );
        const first = screen.getByRole('tab', { name: 'First' });
        first.focus();
        fireEvent.keyDown(first, { key: 'ArrowRight' });
        const last = screen.getByRole('tab', { name: 'Last' });
        expect(last).toHaveFocus();
        expect(last).toHaveAttribute('aria-selected', 'true');
    });

    it('skips nested tabs during keyboard navigation', () => {
        render(
            <Tabs defaultValue="first">
                <TabsList>
                    <TabsTrigger value="first">First</TabsTrigger>
                    <Tabs defaultValue="nested">
                        <TabsList><TabsTrigger value="nested">Nested</TabsTrigger></TabsList>
                    </Tabs>
                    <TabsTrigger value="last">Last</TabsTrigger>
                </TabsList>
            </Tabs>,
        );

        const first = screen.getByRole('tab', { name: 'First' });
        const last = screen.getByRole('tab', { name: 'Last' });
        first.focus();
        fireEvent.keyDown(first, { key: 'ArrowRight' });
        expect(last).toHaveFocus();
        expect(last).toHaveAttribute('aria-selected', 'true');
    });
    it('ignores clicks and skips unavailable tabs during arrow navigation', () => {
        render(
            <Tabs defaultValue="first">
                <TabsList>
                    <TabsTrigger value="first">First</TabsTrigger>
                    <TabsTrigger value="unavailable" aria-disabled="true">Unavailable</TabsTrigger>
                    <TabsTrigger value="last">Last</TabsTrigger>
                </TabsList>
            </Tabs>,
        );

        const first = screen.getByRole('tab', { name: 'First' });
        const unavailable = screen.getByRole('tab', { name: 'Unavailable' });
        const last = screen.getByRole('tab', { name: 'Last' });
        fireEvent.click(unavailable);
        expect(first).toHaveAttribute('aria-selected', 'true');
        first.focus();
        fireEvent.keyDown(first, { key: 'ArrowRight' });
        expect(last).toHaveFocus();
        expect(last).toHaveAttribute('aria-selected', 'true');
    });
    it('moves focus in the visual direction in a right-to-left tab list', () => {
        render(
            <Tabs defaultValue="middle">
                <TabsList style={{ direction: 'rtl' }}>
                    <TabsTrigger value="first">First</TabsTrigger>
                    <TabsTrigger value="middle">Middle</TabsTrigger>
                    <TabsTrigger value="last">Last</TabsTrigger>
                </TabsList>
            </Tabs>,
        );
        const first = screen.getByRole('tab', { name: 'First' });
        const middle = screen.getByRole('tab', { name: 'Middle' });
        middle.focus();
        fireEvent.keyDown(middle, { key: 'ArrowRight' });
        expect(first).toHaveFocus();
        fireEvent.keyDown(first, { key: 'ArrowLeft' });
        expect(middle).toHaveFocus();
        expect(middle).toHaveAttribute('aria-selected', 'true');
    });
    it('uses vertical arrows only in a vertical tab list', () => {
        render(
            <Tabs defaultValue="first">
                <TabsList aria-orientation="vertical">
                    <TabsTrigger value="first">First</TabsTrigger>
                    <TabsTrigger value="last">Last</TabsTrigger>
                </TabsList>
            </Tabs>,
        );

        const first = screen.getByRole('tab', { name: 'First' });
        const last = screen.getByRole('tab', { name: 'Last' });
        first.focus();
        fireEvent.keyDown(first, { key: 'ArrowRight' });
        expect(first).toHaveFocus();
        fireEvent.keyDown(first, { key: 'ArrowDown' });
        expect(last).toHaveFocus();
        expect(last).toHaveAttribute('aria-selected', 'true');
        fireEvent.keyDown(last, { key: 'ArrowUp' });
        expect(first).toHaveFocus();
        expect(first).toHaveAttribute('aria-selected', 'true');
    });
});
