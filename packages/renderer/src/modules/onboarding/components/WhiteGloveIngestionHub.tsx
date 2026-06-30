import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, Play, Pause, XCircle } from 'lucide-react';
import { useStore } from '@/core/store';
import { WhiteGloveIngestionService } from '@/services/ingestion/WhiteGloveIngestionService';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

export const WhiteGloveIngestionHub: React.FC = () => {
    const user = useStore(state => state.user);
    const uploadQueue = useStore(state => state.uploadQueue);
    const [isDragging, setIsDragging] = useState(false);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (!user) return;
        
        acceptedFiles.forEach(file => {
            let assetType = 'document';
            if (file.type.startsWith('audio/')) assetType = 'music';
            else if (file.type.startsWith('video/')) assetType = 'video';
            else if (file.type.startsWith('image/')) assetType = 'image';
            else if (file.name.endsWith('.zip') || file.type.includes('zip') || file.type.includes('tar') || file.type.includes('archive')) {
                assetType = 'archive';
            }

            WhiteGloveIngestionService.enqueueAsset(file, assetType, user.uid);
        });
    }, [user]);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        onDragEnter: () => setIsDragging(true),
        onDragLeave: () => setIsDragging(false),
        onDropAccepted: () => setIsDragging(false),
        onDropRejected: () => setIsDragging(false)
    });

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="flex flex-col h-full w-full max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-white">White-Glove Ingestion</h1>
                <p className="text-gray-400">
                    Drop extensive catalogs, multi-track stems, and 4K music videos here. Our AI will automatically categorize, extract metadata, and prepare them for your vault.
                </p>
            </div>

            <Card 
                {...getRootProps()} 
                className={`border-2 border-dashed bg-black/40 backdrop-blur-md transition-all duration-300 ease-in-out cursor-pointer group ${
                    isDragging ? 'border-green-500 bg-green-500/10' : 'border-gray-800 hover:border-green-500/50 hover:bg-gray-900/50'
                }`}
            >
                <input {...getInputProps()} />
                <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-6">
                    <div className={`p-4 rounded-full transition-colors duration-300 ${isDragging ? 'bg-green-500/20 text-green-400' : 'bg-gray-900 text-gray-500 group-hover:bg-green-500/10 group-hover:text-green-400'}`}>
                        <UploadCloud size={48} strokeWidth={1.5} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-white">Drag & drop large files here</h3>
                        <p className="text-sm text-gray-400 max-w-sm mx-auto">
                            Supports ZIP archives up to 10GB, FLAC stems, 4K ProRes videos, and bulk metadata sheets.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {uploadQueue.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">Active Processing ({uploadQueue.length})</h2>
                    <div className="grid gap-4">
                        {uploadQueue.map(item => (
                            <Card key={item.id} className="bg-gray-900/50 border-gray-800 overflow-hidden">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="p-3 bg-black rounded-lg text-green-400">
                                        <File size={24} />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium text-white truncate max-w-[300px]" title={item.fileName}>
                                                {item.fileName}
                                            </p>
                                            <span className="text-xs font-mono text-gray-400">
                                                {formatBytes(item.fileSize)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Progress 
                                                value={item.progress} 
                                                className="h-1.5 flex-1"
                                                indicatorClassName={
                                                    item.status === 'error' ? 'bg-red-500' :
                                                    item.status === 'success' || item.status === 'post-processing' ? 'bg-green-500' : 
                                                    'bg-green-500'
                                                }
                                            />
                                            <span className="text-xs font-medium w-16 text-right text-gray-400">
                                                {Math.round(item.progress)}%
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className={`capitalize ${
                                                item.status === 'error' ? 'text-red-400' :
                                                item.status === 'success' ? 'text-green-400' :
                                                item.status === 'post-processing' ? 'text-blue-400 animate-pulse' :
                                                'text-gray-500'
                                            }`}>
                                                {item.status.replace('-', ' ')}
                                                {item.error && ` - ${item.error}`}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {item.status === 'uploading' && (
                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); WhiteGloveIngestionService.pauseUpload(item.id); }} className="text-gray-400 hover:text-white">
                                                <Pause size={18} />
                                            </Button>
                                        )}
                                        {item.status === 'paused' && (
                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); WhiteGloveIngestionService.resumeUpload(item.id); }} className="text-gray-400 hover:text-white">
                                                <Play size={18} />
                                            </Button>
                                        )}
                                        {(item.status === 'uploading' || item.status === 'paused') && (
                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); WhiteGloveIngestionService.cancelUpload(item.id); }} className="text-gray-400 hover:text-red-400">
                                                <XCircle size={18} />
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
