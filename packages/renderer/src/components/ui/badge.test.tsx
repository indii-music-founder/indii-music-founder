import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Badge } from './badge';

it('uses the caller palette for a status badge with custom colors', () => {
    render(<Badge className="bg-green-500/20 text-green-400">Optimal</Badge>);
    const badge = screen.getByText('Optimal');
    expect(badge).toHaveClass('bg-green-500/20', 'text-green-400');
    expect(badge).not.toHaveClass('bg-primary', 'text-primary-foreground');
});
