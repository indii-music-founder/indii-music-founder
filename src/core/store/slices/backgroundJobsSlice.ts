import { StateCreator } from 'zustand';

export type BackgroundJobStatus = 'running' | 'success' | 'error';
export type BackgroundJobType = 'video_render' | 'audio_process' | 'ai_generation' | 'export';

export interface BackgroundJob {
    id: string;
    title: string;
    progress: number; // 0 to 100
    status: BackgroundJobStatus;
    type: BackgroundJobType;
    error?: string;
}

export interface BackgroundJobsSlice {
    backgroundJobs: BackgroundJob[];
    isJobMonitorOpen: boolean;

    addJob: (job: BackgroundJob) => void;
    updateJobProgress: (id: string, progress: number) => void;
    updateJobStatus: (id: string, status: BackgroundJobStatus, error?: string) => void;
    removeJob: (id: string) => void;
    clearCompletedJobs: () => void;
    toggleJobMonitor: (isOpen?: boolean) => void;
}

export const createBackgroundJobsSlice: StateCreator<BackgroundJobsSlice> = (set) => ({
    backgroundJobs: [],
    isJobMonitorOpen: false,

    addJob: (job) => set((state) => {
        // Prevent duplicate IDs
        if (state.backgroundJobs.find(j => j.id === job.id)) {
            return {
                backgroundJobs: state.backgroundJobs.map(j => j.id === job.id ? { ...j, ...job } : j),
                isJobMonitorOpen: true
            };
        }
        return {
            backgroundJobs: [...state.backgroundJobs, job],
            isJobMonitorOpen: true // Auto-open when items are added
        };
    }),

    updateJobProgress: (id, progress) => set((state) => ({
        backgroundJobs: state.backgroundJobs.map(item =>
            item.id === id ? { ...item, progress } : item
        )
    })),

    updateJobStatus: (id, status, error) => set((state) => ({
        backgroundJobs: state.backgroundJobs.map(item =>
            item.id === id ? { ...item, status, error } : item
        )
    })),

    removeJob: (id) => set((state) => ({
        backgroundJobs: state.backgroundJobs.filter(item => item.id !== id)
    })),

    clearCompletedJobs: () => set((state) => ({
        backgroundJobs: state.backgroundJobs.filter(item => item.status !== 'success')
    })),

    toggleJobMonitor: (isOpen) => set((state) => ({
        isJobMonitorOpen: isOpen !== undefined ? isOpen : !state.isJobMonitorOpen
    }))
});
