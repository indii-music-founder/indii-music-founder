import { genkit } from "genkit";
import { z } from "zod";

const ai = genkit({
    name: "indii-cloudrun-genkit",
});

export const helloGenkit = ai.defineFlow(
    {
        name: "helloGenkit",
        inputSchema: z.string(),
        outputSchema: z.object({ message: z.string() }),
    },
    async (subject) => ({ message: `Hello, ${subject}! Genkit is running.` })
);

export const healthCheck = ai.defineFlow(
    {
        name: "healthCheck",
        inputSchema: z.object({}),
        outputSchema: z.object({ status: z.literal("ok") }),
    },
    async () => ({ status: "ok" })
);

export const flows = [helloGenkit, healthCheck];
