import type { HarnessDomain, HarnessRun } from './types.js';
export interface HarnessContext {
    userId: string;
    projectId?: string;
    save?: boolean;
}
export interface HarnessCompiler<TInput = unknown, TOutput = Record<string, unknown>> {
    readonly domain: HarnessDomain;
    compile(input: TInput, ctx: HarnessContext): Promise<HarnessRun<TOutput>> | HarnessRun<TOutput>;
}
export declare class HarnessRegistry {
    private static compilers;
    static register<TIn, TOut>(compiler: HarnessCompiler<TIn, TOut>): void;
    static get(domain: HarnessDomain): HarnessCompiler<unknown, unknown>;
    static getAllRegisteredDomains(): HarnessDomain[];
}
export declare function compileHarness<TInput, TOutput>(domain: HarnessDomain, input: TInput, ctx: HarnessContext): Promise<HarnessRun<TOutput>>;
//# sourceMappingURL=HarnessCompiler.d.ts.map