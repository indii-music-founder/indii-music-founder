import { z } from 'zod';
import { Project } from '@/core/store/slices/appSlice';
import { ProjectMetadata } from './DashboardService';

/**
 * Zod Schema for Project (Firestore representation)
 * This is the source of truth for data coming from the database.
 */
export const ProjectSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    date: z.number().optional().default(() => Date.now()),
    orgId: z.string(),
    userId: z.string().optional(),
});

/**
 * Zod Schema for ProjectMetadata (UI representation)
 * This is the format expected by dashboard components.
 */
export const ProjectMetadataSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    lastModified: z.number(),
    assetCount: z.number(),
    thumbnail: z.string().optional(),
});

/**
 * Type-safe conversion from Project (Firestore) to ProjectMetadata (UI)
 * 
 * This function enforces the boundary between database and UI representations.
 * It validates the input and ensures the output matches the expected schema.
 * 
 * @param project - The Project object from Firestore
 * @param assetCount - Optional asset count (defaults to 0)
 * @param thumbnail - Optional thumbnail URL
 * @returns ProjectMetadata object for UI consumption
 * @throws {z.ZodError} If the input project doesn't match the expected schema
 */
export function projectToMetadata(
    project: Project,
    assetCount: number = 0,
    thumbnail?: string
): ProjectMetadata {
    // Runtime validation to catch type mismatches early
    const validatedProject = ProjectSchema.parse(project);

    const metadata: ProjectMetadata = {
        id: validatedProject.id,
        name: validatedProject.name,
        type: validatedProject.type as any, // Cast to ModuleId (handled by interface)
        lastModified: validatedProject.date, // KEY CONVERSION: date → lastModified
        assetCount,
        thumbnail,
    };

    // Validate output to ensure type safety
    return ProjectMetadataSchema.parse(metadata) as ProjectMetadata;
}

/**
 * Batch conversion utility for arrays
 * 
 * @param projects - Array of Project objects
 * @returns Array of ProjectMetadata objects
 */
export function projectsToMetadata(projects: Project[]): ProjectMetadata[] {
    return projects.map(p => projectToMetadata(p));
}

/**
 * Type guard to check if an object is a valid Project
 */
export function isProject(obj: unknown): obj is Project {
    return ProjectSchema.safeParse(obj).success;
}

/**
 * Type guard to check if an object is a valid ProjectMetadata
 */
export function isProjectMetadata(obj: unknown): obj is ProjectMetadata {
    return ProjectMetadataSchema.safeParse(obj).success;
}
