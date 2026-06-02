import type { HarnessDomain, HarnessRun } from './types.js';

export interface HarnessContext {
  userId: string;
  projectId?: string;
  save?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface HarnessCompiler<TInput = any, TOutput = Record<string, unknown>> {
  readonly domain: HarnessDomain;
  compile(input: TInput, ctx: HarnessContext): Promise<HarnessRun<TOutput>> | HarnessRun<TOutput>;
}

export class HarnessRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static compilers = new Map<HarnessDomain, HarnessCompiler<any, any>>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static register(compiler: HarnessCompiler<any, any>): void {
    if (this.compilers.has(compiler.domain)) {
      console.warn(`HarnessCompiler for domain ${compiler.domain} is already registered. Overwriting.`);
    }
    this.compilers.set(compiler.domain, compiler);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static get(domain: HarnessDomain): HarnessCompiler<any, any> {
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
  const compiler = HarnessRegistry.get(domain) as HarnessCompiler<TInput, TOutput>;
  return compiler.compile(input, ctx);
}
