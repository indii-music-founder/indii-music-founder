import JSZip from 'jszip';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { ProjectService } from './ProjectService';
import { Project } from '@/core/store/slices/appSlice';
import { HistoryItem } from '@/core/store/slices/creativeSlice';

export interface ExportProgress {
    phase: 'metadata' | 'assets' | 'packaging' | 'complete';
    current: number;
    total: number;
    message: string;
}

export interface ExportOptions {
    includeMetadata?: boolean;
    includeAssets?: boolean;
    onProgress?: (progress: ExportProgress) => void;
}

class ExportServiceImpl {
    /**
     * Export a single project to ZIP
     */
    async exportProject(
        projectId: string,
        options: ExportOptions = {}
    ): Promise<Blob> {
        const {
            includeMetadata = true,
            includeAssets = true,
            onProgress
        } = options;

        const zip = new JSZip();

        // Phase 1: Fetch project metadata
        onProgress?.({
            phase: 'metadata',
            current: 0,
            total: 1,
            message: 'Fetching project data...'
        });

        const project = await ProjectService.get(projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }

        // Fetch history items for this project
        const historyItems = await this.getProjectHistory(projectId);

        onProgress?.({
            phase: 'metadata',
            current: 1,
            total: 1,
            message: `Found ${historyItems.length} assets`
        });

        // Phase 2: Add metadata
        if (includeMetadata) {
            const manifest = {
                exportVersion: '1.0',
                exportDate: new Date().toISOString(),
                project: {
                    id: project.id,
                    name: project.name,
                    type: project.type,
                    date: project.date,
                    orgId: project.orgId
                },
                assets: historyItems.map(item => ({
                    id: item.id,
                    type: item.type,
                    prompt: item.prompt,
                    timestamp: item.timestamp,
                    filename: this.getAssetFilename(item)
                }))
            };

            zip.file('manifest.json', JSON.stringify(manifest, null, 2));
            zip.file('prompts.txt', this.generatePromptsFile(historyItems));
        }

        // Phase 3: Download and add assets
        if (includeAssets && historyItems.length > 0) {
            const assetsFolder = zip.folder('assets');

            for (let i = 0; i < historyItems.length; i++) {
                const item = historyItems[i];

                onProgress?.({
                    phase: 'assets',
                    current: i + 1,
                    total: historyItems.length,
                    message: `Downloading ${item.type} ${i + 1}/${historyItems.length}`
                });

                try {
                    const blob = await this.fetchAsset(item.url);
                    const filename = this.getAssetFilename(item);
                    assetsFolder?.file(filename, blob);
                } catch (error) {
                    console.warn(`Failed to fetch asset ${item.id}:`, error);
                    // Continue with other assets
                }
            }
        }

        // Phase 4: Generate ZIP
        onProgress?.({
            phase: 'packaging',
            current: 0,
            total: 1,
            message: 'Creating ZIP file...'
        });

        const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        onProgress?.({
            phase: 'complete',
            current: 1,
            total: 1,
            message: 'Export complete!'
        });

        return blob;
    }

    /**
     * Export all projects for an organization
     */
    async exportOrganization(
        orgId: string,
        options: ExportOptions = {}
    ): Promise<Blob> {
        const { onProgress } = options;
        const zip = new JSZip();

        // Fetch all projects for org
        onProgress?.({
            phase: 'metadata',
            current: 0,
            total: 1,
            message: 'Fetching organization projects...'
        });

        const projects = await ProjectService.getProjectsForOrg(orgId);

        // Create org manifest
        const orgManifest = {
            exportVersion: '1.0',
            exportDate: new Date().toISOString(),
            orgId,
            projectCount: projects.length,
            projects: projects.map(p => ({
                id: p.id,
                name: p.name,
                type: p.type,
                date: p.date
            }))
        };

        zip.file('organization.json', JSON.stringify(orgManifest, null, 2));

        // Export each project
        for (let i = 0; i < projects.length; i++) {
            const project = projects[i];

            onProgress?.({
                phase: 'assets',
                current: i + 1,
                total: projects.length,
                message: `Exporting project: ${project.name}`
            });

            try {
                const projectZip = await this.exportProject(project.id, {
                    ...options,
                    onProgress: undefined // Don't propagate nested progress
                });

                // Add project ZIP as a file in the org export
                const safeName = this.sanitizeFilename(project.name);
                zip.file(`projects/${safeName}_${project.id.slice(0, 8)}.zip`, projectZip);
            } catch (error) {
                console.warn(`Failed to export project ${project.id}:`, error);
            }
        }

        onProgress?.({
            phase: 'packaging',
            current: 0,
            total: 1,
            message: 'Creating organization backup...'
        });

        const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        onProgress?.({
            phase: 'complete',
            current: 1,
            total: 1,
            message: 'Organization export complete!'
        });

        return blob;
    }

    /**
     * Trigger browser download for a blob
     */
    downloadBlob(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Export and download a project
     */
    async exportAndDownloadProject(
        projectId: string,
        projectName: string,
        options: ExportOptions = {}
    ): Promise<void> {
        const blob = await this.exportProject(projectId, options);
        const safeName = this.sanitizeFilename(projectName);
        const timestamp = new Date().toISOString().split('T')[0];
        this.downloadBlob(blob, `${safeName}_${timestamp}.zip`);
    }

    /**
     * Export and download organization backup
     */
    async exportAndDownloadOrganization(
        orgId: string,
        orgName: string,
        options: ExportOptions = {}
    ): Promise<void> {
        const blob = await this.exportOrganization(orgId, options);
        const safeName = this.sanitizeFilename(orgName);
        const timestamp = new Date().toISOString().split('T')[0];
        this.downloadBlob(blob, `${safeName}_backup_${timestamp}.zip`);
    }

    // Private helper methods

    private async getProjectHistory(projectId: string): Promise<HistoryItem[]> {
        try {
            const historyRef = collection(db, 'history');
            const q = query(historyRef, where('projectId', '==', projectId));
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    type: data.type,
                    url: data.url,
                    prompt: data.prompt,
                    timestamp: data.timestamp?.toMillis?.() || data.timestamp,
                    projectId: data.projectId,
                    orgId: data.orgId,
                    meta: data.meta,
                    mask: data.mask
                } as HistoryItem;
            });
        } catch (error) {
            console.error('Error fetching project history:', error);
            return [];
        }
    }

    private async fetchAsset(url: string): Promise<Blob> {
        // Handle base64 data URLs
        if (url.startsWith('data:')) {
            return this.dataUrlToBlob(url);
        }

        // Handle remote URLs (Firebase Storage, etc.)
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }
        return response.blob();
    }

    private dataUrlToBlob(dataUrl: string): Blob {
        const parts = dataUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const base64 = parts[1];
        const binary = atob(base64);
        const array = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }

        return new Blob([array], { type: mime });
    }

    private getAssetFilename(item: HistoryItem): string {
        const ext = this.getExtensionForType(item.type, item.url);
        const timestamp = new Date(item.timestamp).toISOString().replace(/[:.]/g, '-');
        return `${item.type}_${timestamp}_${item.id.slice(0, 8)}.${ext}`;
    }

    private getExtensionForType(type: string, url: string): string {
        // Try to get extension from URL
        if (url.includes('.png')) return 'png';
        if (url.includes('.jpg') || url.includes('.jpeg')) return 'jpg';
        if (url.includes('.webp')) return 'webp';
        if (url.includes('.mp4')) return 'mp4';
        if (url.includes('.webm')) return 'webm';
        if (url.includes('.mp3')) return 'mp3';
        if (url.includes('.wav')) return 'wav';

        // Default based on type
        switch (type) {
            case 'image': return 'png';
            case 'video': return 'mp4';
            case 'music': return 'mp3';
            default: return 'bin';
        }
    }

    private generatePromptsFile(items: HistoryItem[]): string {
        const lines = items.map((item, index) => {
            const date = new Date(item.timestamp).toLocaleString();
            return `[${index + 1}] ${item.type.toUpperCase()} - ${date}\n${item.prompt}\n`;
        });

        return `# Project Prompts Export\n# Generated: ${new Date().toISOString()}\n\n${lines.join('\n---\n\n')}`;
    }

    private sanitizeFilename(name: string): string {
        return name
            .replace(/[/\\?%*:|"<>]/g, '-')
            .replace(/\s+/g, '_')
            .slice(0, 50);
    }
}

export const ExportService = new ExportServiceImpl();
