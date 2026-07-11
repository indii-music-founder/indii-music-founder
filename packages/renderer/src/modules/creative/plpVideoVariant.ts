type VideoToken = { id: string; url: string; prompt: string };
type CompletedVideoJob = {
    output?: { url?: string };
    videoUrl?: string;
    url?: string;
};

export async function awaitCompletedPlpVideoVariant(
    start: () => Promise<VideoToken[]>,
    waitForJob: (jobId: string) => Promise<CompletedVideoJob>,
): Promise<VideoToken[]> {
    const token = (await start())[0];
    if (!token?.id) throw new Error('Video generation did not return a job ID.');

    const completed = await waitForJob(token.id);
    const url = completed.output?.url || completed.videoUrl || completed.url;
    if (!url) throw new Error(`Completed video job ${token.id} has no playable output URL.`);

    return [{ ...token, url }];
}
