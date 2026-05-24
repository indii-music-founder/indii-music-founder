export function getKeyframeColor(easing?: string): string {
    switch (easing) {
        case 'easeIn': return 'bg-blue-400';
        case 'easeOut': return 'bg-green-400';
        case 'easeInOut': return 'bg-purple-400';
        default: return 'bg-yellow-400';
    }
}
