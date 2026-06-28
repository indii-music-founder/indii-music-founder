import { z } from 'zod';
export declare const CommonEnvSchema: z.ZodObject<{
    apiKey: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    projectId: z.ZodString;
    location: z.ZodDefault<z.ZodString>;
    functionsRegion: z.ZodDefault<z.ZodString>;
    useVertex: z.ZodDefault<z.ZodBoolean>;
    googleMapsApiKey: z.ZodOptional<z.ZodString>;
    firebaseApiKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    apiKey: string;
    projectId: string;
    location: string;
    functionsRegion: string;
    useVertex: boolean;
    googleMapsApiKey?: string | undefined;
    firebaseApiKey?: string | undefined;
}, {
    projectId: string;
    apiKey?: string | undefined;
    location?: string | undefined;
    functionsRegion?: string | undefined;
    useVertex?: boolean | undefined;
    googleMapsApiKey?: string | undefined;
    firebaseApiKey?: string | undefined;
}>;
export type CommonEnv = z.infer<typeof CommonEnvSchema>;
//# sourceMappingURL=env.schema.d.ts.map