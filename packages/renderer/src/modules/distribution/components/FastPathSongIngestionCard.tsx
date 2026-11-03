import { useState, type ChangeEvent, type DragEvent } from 'react';
import { FileAudio, UploadCloud } from 'lucide-react';

export interface IngestedSongAnalysis {
    file: File;
    cleanedTitle: string;
    artistName: string;
    versionType: string;
}

interface Props {
    artistName?: string;
    onComplete?: (analysis: IngestedSongAnalysis) => void;
    className?: string;
}

function filenameMetadata(filename: string): { title: string; version: string } {
    const base = filename.replace(/\.[^/.]+$/, '');
    const version = /remix/i.test(base) ? 'Remix'
        : /acoustic/i.test(base) ? 'Acoustic'
            : /radio\s*edit/i.test(base) ? 'Radio Edit'
                : /club\s*mix/i.test(base) ? 'Club Mix'
                    : /instrumental/i.test(base) ? 'Instrumental'
                        : 'Original';
    const title = base.replace(/[-_](master|final|v\d+|remix|mix|bounce|export|4416|4824).*/gi, '')
        .replace(/[_-]+/g, ' ').trim() || 'Untitled Track';
    return { title, version };
}

/** A file selection preview. Audio analysis and release clearance require verified inputs. */
export function FastPathSongIngestionCard({ artistName = 'indii artist', onComplete, className = '' }: Props) {
    const [isDragging, setIsDragging] = useState(false);
    const [analysis, setAnalysis] = useState<IngestedSongAnalysis | null>(null);

    const selectFile = (file: File | undefined) => {
        if (!file || !(file.type.startsWith('audio/') || /\.(wav|flac|mp3|aiff|m4a)$/i.test(file.name))) return;
        const { title, version } = filenameMetadata(file.name);
        const selected = { file, cleanedTitle: title, artistName, versionType: version };
        setAnalysis(selected);
        onComplete?.(selected);
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        selectFile(Array.from(event.dataTransfer.files).find(file => file.type.startsWith('audio/') || /\.(wav|flac|mp3|aiff|m4a)$/i.test(file.name)));
    };

    const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => selectFile(event.target.files?.[0]);

    return (
        <section className={`w-full max-w-4xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-950/90 p-6 ${className}`} aria-label="Song file preview">
            <h2 className="text-xl font-bold text-white">Song file preview</h2>
            <p className="mt-1 text-sm text-zinc-400">Select a local audio file to review its filename and file size.</p>
            {!analysis ? (
                <div
                    onDragOver={event => { event.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`mt-5 rounded-xl border-2 border-dashed p-8 text-center ${isDragging ? 'border-emerald-500' : 'border-zinc-700'}`}
                >
                    <UploadCloud className="mx-auto mb-3 text-emerald-400" aria-hidden="true" />
                    <label htmlFor="song-file-preview" className="block text-sm font-medium text-white">Choose an audio file or drag it here</label>
                    <input id="song-file-preview" type="file" accept="audio/*,.wav,.flac,.mp3,.aiff,.m4a" onChange={handleFileSelect} className="mt-3 block w-full text-sm text-zinc-300" />
                </div>
            ) : (
                <div className="mt-5 rounded-xl border border-zinc-700 p-4">
                    <div className="flex items-center gap-3"><FileAudio className="text-emerald-400" aria-hidden="true" /><h3 className="font-semibold text-white">{analysis.cleanedTitle}</h3></div>
                    <p className="mt-2 text-sm text-zinc-300">{analysis.artistName} · {analysis.versionType} · {analysis.file.name} · {(analysis.file.size / 1024).toFixed(1)} KB</p>
                    <p className="mt-3 text-sm text-amber-300" role="status">Audio format, BPM, rights, artwork, identifiers, and distribution readiness have not been verified.</p>
                    <button type="button" onClick={() => setAnalysis(null)} className="mt-4 text-sm text-emerald-300 underline">Choose another file</button>
                </div>
            )}
        </section>
    );
}

export default FastPathSongIngestionCard;
