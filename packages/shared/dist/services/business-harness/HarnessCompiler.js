export class HarnessRegistry {
    static compilers = new Map();
    static register(compiler) {
        if (this.compilers.has(compiler.domain)) {
            console.warn(`HarnessCompiler for domain ${compiler.domain} is already registered. Overwriting.`);
        }
        this.compilers.set(compiler.domain, compiler);
    }
    static get(domain) {
        const compiler = this.compilers.get(domain);
        if (!compiler) {
            throw new Error(`No HarnessCompiler registered for domain: ${domain}`);
        }
        return compiler;
    }
    static getAllRegisteredDomains() {
        return Array.from(this.compilers.keys());
    }
}
export async function compileHarness(domain, input, ctx) {
    const compiler = HarnessRegistry.get(domain);
    return compiler.compile(input, ctx);
}
