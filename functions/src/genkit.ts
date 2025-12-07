
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { z } from "zod";

export const ai = genkit({
    plugins: [
        googleAI(),
    ],
});

export const helloGenkit = ai.defineFlow(
    {
        name: "helloGenkit",
        inputSchema: z.string(),
        outputSchema: z.string(),
    },
    async (subject) => {
        return `Hello, ${subject}! Genkit is running.`;
    }
);
