// eslint-disable-next-line @typescript-eslint/no-explicit-any -- HoF generic bound: `any` is the correct constraint for passthrough wrappers (mirrors TypeScript's own lib.d.ts)
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- required for Function.prototype.apply
    return function (this: any, ...args: Parameters<T>): void {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, wait);
    };
}
