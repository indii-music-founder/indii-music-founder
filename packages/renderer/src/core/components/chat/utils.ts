import React from 'react';

export type ReactChildNode = React.ReactNode | { props?: { children?: React.ReactNode } };

export const getText = (node: ReactChildNode): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getText).join('');
    if (typeof node === 'object' && node !== null && 'props' in node) {
        return getText(node.props?.children);
    }
    return '';
};
