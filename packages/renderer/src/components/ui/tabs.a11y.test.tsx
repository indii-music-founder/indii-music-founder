import { render, screen } from '@testing-library/react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
import { describe, it, expect, vi } from 'vitest'
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

    it('keeps one tab stop while Home and End skip disabled tabs', async () => {
        const user = userEvent.setup()
        render(
            <Tabs defaultValue="first">
                <TabsList>
                    <TabsTrigger value="first">First</TabsTrigger>
                    <TabsTrigger value="disabled" disabled>Disabled</TabsTrigger>
                    <TabsTrigger value="last">Last</TabsTrigger>
                </TabsList>
                <TabsContent value="first">First panel</TabsContent>
                <TabsContent value="last">Last panel</TabsContent>
            </Tabs>
        )
        const first = screen.getByRole('tab', { name: 'First' })
        const disabled = screen.getByRole('tab', { name: 'Disabled' })
        const last = screen.getByRole('tab', { name: 'Last' })
        expect([first, disabled, last].filter(tab => tab.tabIndex === 0)).toEqual([first])
        first.focus()
        await user.keyboard('{End}')
        expect(last).toHaveFocus()
        expect(last).toHaveAttribute('aria-selected', 'true')
        expect([first, disabled, last].filter(tab => tab.tabIndex === 0)).toEqual([last])
        await user.keyboard('{Home}')
        expect(first).toHaveFocus()
        expect(disabled).toHaveAttribute('tabindex', '-1')
    })

    it('composes a caller click handler with controlled selection and honors preventDefault', async () => {
        const user = userEvent.setup()
        const onValueChange = vi.fn()
        const onClick = vi.fn()
        const blocked = vi.fn((event: React.MouseEvent) => event.preventDefault())
        render(
            <Tabs value="first" onValueChange={onValueChange}>
                <TabsList>
                    <TabsTrigger value="first">First</TabsTrigger>
                    <TabsTrigger value="second" onClick={onClick}>Second</TabsTrigger>
                    <TabsTrigger value="blocked" onClick={blocked}>Blocked</TabsTrigger>
                </TabsList>
                <TabsContent value="first">First panel</TabsContent>
            </Tabs>
        )
        await user.click(screen.getByRole('tab', { name: 'Second' }))
        expect(onClick).toHaveBeenCalledOnce()
        expect(onValueChange).toHaveBeenCalledWith('second')
        expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('aria-selected', 'true')
        await user.click(screen.getByRole('tab', { name: 'Blocked' }))
        expect(blocked).toHaveBeenCalledOnce()
        expect(onValueChange).toHaveBeenCalledTimes(1)
    })
})
