// eslint-disable-next-line @typescript-eslint/no-explicit-any -- HoF generic bound: `any` is the correct constraint for passthrough wrappers (mirrors TypeScript's own lib.d.ts)
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- required for Function.prototype.apply
    return function (this: any, ...args: Parameters<T>): void {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}
