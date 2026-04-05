import { render, screen } from '@testing-library/react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
import { describe, it, expect } from 'vitest'
import { axe } from 'vitest-axe'
import * as matchers from 'vitest-axe/matchers'
import React from 'react'
import userEvent from '@testing-library/user-event'

expect.extend(matchers)

describe('Tabs Accessibility', () => {
    it('should have no accessibility violations', async () => {
        const { container } = render(
            <Tabs defaultValue="tab1">
                <TabsList>
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content 1</TabsContent>
                <TabsContent value="tab2">Content 2</TabsContent>
            </Tabs>
        )

        const results = await axe(container)
        expect(results).toHaveNoViolations()
    })

    it('should navigate tabs using arrow keys', async () => {
        const user = userEvent.setup()
        render(
            <Tabs defaultValue="tab1">
                <TabsList>
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                    <TabsTrigger value="tab3">Tab 3</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content 1</TabsContent>
                <TabsContent value="tab2">Content 2</TabsContent>
                <TabsContent value="tab3">Content 3</TabsContent>
            </Tabs>
        )

        const tab1 = screen.getByRole('tab', { name: 'Tab 1' })
        const tab2 = screen.getByRole('tab', { name: 'Tab 2' })
        const tab3 = screen.getByRole('tab', { name: 'Tab 3' })

        // Click to focus first tab (or just tab to it)
        await user.click(tab1)
        expect(tab1).toHaveFocus()

        // Arrow Right -> Tab 2
        await user.keyboard('{ArrowRight}')
        expect(tab2).toHaveFocus()
        expect(tab2).toHaveAttribute('aria-selected', 'true')

        // Arrow Right -> Tab 3
        await user.keyboard('{ArrowRight}')
        expect(tab3).toHaveFocus()

        // Arrow Left -> Tab 2
        await user.keyboard('{ArrowLeft}')
        expect(tab2).toHaveFocus()
    })
})
