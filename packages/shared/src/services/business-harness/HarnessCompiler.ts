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

export class HarnessRegistry {
  private static compilers = new Map<HarnessDomain, HarnessCompiler<unknown, unknown>>();

  static register<TIn, TOut>(compiler: HarnessCompiler<TIn, TOut>): void {
    if (this.compilers.has(compiler.domain)) {
      console.warn(`HarnessCompiler for domain ${compiler.domain} is already registered. Overwriting.`);
    }
    this.compilers.set(compiler.domain, compiler as unknown as HarnessCompiler<unknown, unknown>);
  }

  static get(domain: HarnessDomain): HarnessCompiler<unknown, unknown> {
    const compiler = this.compilers.get(domain);
    if (!compiler) {
      throw new Error(`No HarnessCompiler registered for domain: ${domain}`);
    }
    return compiler;
  }
  
  static getAllRegisteredDomains(): HarnessDomain[] {
    return Array.from(this.compilers.keys());
  }
}

export async function compileHarness<TInput, TOutput>(
  domain: HarnessDomain,
  input: TInput,
  ctx: HarnessContext
): Promise<HarnessRun<TOutput>> {
  const compiler = HarnessRegistry.get(domain) as unknown as HarnessCompiler<TInput, TOutput>;
  return compiler.compile(input, ctx);
}
