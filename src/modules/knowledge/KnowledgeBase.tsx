import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, Book, Loader, RefreshCw } from 'lucide-react';
import { GeminiRetrieval } from '../../services/rag/GeminiRetrievalService';
import { processForKnowledgeBase } from '../../services/rag/ragService';
import { useToast } from '@/core/context/ToastContext';

interface Doc {
    name: string;
    displayName: string;
    state?: string;
}

export default function KnowledgeBase() {
    const [documents, setDocuments] = useState<Doc[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            const corpusName = await GeminiRetrieval.initCorpus();
            const res = await GeminiRetrieval.listDocuments(corpusName);
            setDocuments(res.documents || []);
        } catch (error) {
            console.error("Failed to load documents:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const text = await file.text();
            // We use the filename as context source
            await processForKnowledgeBase(text, file.name);
            await loadDocuments(); // Refresh list
            toast.success(`Successfully uploaded ${file.name}`);
        } catch (error: any) {
            console.error("Upload failed:", error);
            toast.error(`Failed to upload document: ${error.message || "Unknown error"}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (docName: string) => {
        if (!confirm("Are you sure you want to delete this document?")) return;
        try {
            await GeminiRetrieval.deleteDocument(docName);
            await loadDocuments();
        } catch (error) {
            console.error("Delete failed:", error);
        }
    };

    const [stressLogs, setStressLogs] = useState<string[]>([]);

    const runStressTest = async () => {
        if (!confirm("Run Stress Test? This will create 5 dummy documents and query them.")) return;
        setUploading(true);
        setStressLogs(["Starting Stress Test..."]);

        try {
            // 1. Create 5 dummy documents in parallel
            const dummyDocs = Array.from({ length: 5 }).map((_, i) => ({
                name: `stress-test-${Date.now()}-${i}.txt`,
                content: `This is stress test document #${i}. The secret code for #${i} is ALPHA-${i}-${Math.random().toString(36).substring(7)}.`
            }));

            setStressLogs(prev => [...prev, "Ingesting 5 documents..."]);
            console.time("Stress Test Ingestion");
            await Promise.all(dummyDocs.map(doc => processForKnowledgeBase(doc.content, doc.name)));
            console.timeEnd("Stress Test Ingestion");
            setStressLogs(prev => [...prev, "Ingestion Complete."]);

            await loadDocuments();

            // 2. Query them in parallel
            setStressLogs(prev => [...prev, "Querying 5 documents..."]);
            console.time("Stress Test Query");
            const corpusName = await GeminiRetrieval.initCorpus();
            const queries = dummyDocs.map((_, i) => GeminiRetrieval.query(corpusName, `What is the secret code for document #${i}?`));
            const results = await Promise.all(queries);
            console.timeEnd("Stress Test Query");

            const resultSummary = results.map((r, i) => `Doc #${i}: ${r.answer?.content?.parts?.[0]?.text || 'No answer'}`);
            setStressLogs(prev => [...prev, "Querying Complete.", ...resultSummary, "STRESS TEST FINISHED"]);

        } catch (error) {
            console.error("Stress Test Failed:", error);
            setStressLogs(prev => [...prev, `FAILED: ${error}`]);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-surface text-white p-8 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        Knowledge Base
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Upload documents to train the AI agents. Supported formats: TXT, MD, JSON.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        id="btn-stress-test"
                        onClick={runStressTest}
                        className="px-3 py-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-lg text-sm font-medium transition-colors border border-red-900/50"
                    >
                        Stress Test
                    </button>
                    <button
                        onClick={loadDocuments}
                        className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {stressLogs.length > 0 && (
                <div className="bg-black/50 border border-gray-700 rounded-xl p-4 mb-8 font-mono text-xs text-green-400 max-h-60 overflow-y-auto" id="stress-test-logs">
                    {stressLogs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
            )}

            {/* Upload Area */}
            <div
                className={`border-2 border-dashed border-gray-700 rounded-2xl p-12 flex flex-col items-center justify-center transition-colors cursor-pointer mb-12 ${uploading ? 'bg-gray-800/50 border-blue-500' : 'hover:bg-gray-800/30 hover:border-gray-500'}`}
                onClick={() => !uploading && fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".txt,.md,.json,.csv"
                    onChange={handleFileUpload}
                />

                {uploading ? (
                    <div className="flex flex-col items-center animate-pulse">
                        <Loader size={48} className="text-blue-400 animate-spin mb-4" />
                        <p className="text-xl font-medium text-blue-300">Ingesting Knowledge...</p>
                        <p className="text-sm text-gray-500 mt-2">Reading, Chunking, and Embedding</p>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
                            <Upload size={32} />
                        </div>
                        <h3 className="text-xl font-medium text-gray-200">Drop files here or click to upload</h3>
                        <p className="text-gray-500 mt-2">Teach the AI about your project, brand guidelines, or research.</p>
                    </>
                )}
            </div>

            {/* Document List */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-300 flex items-center gap-2">
                    <Book size={20} />
                    Library ({documents.length})
                </h2>

                {loading && documents.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">Loading library...</div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-12 text-gray-600 bg-gray-900/30 rounded-xl border border-gray-800">
                        No documents found. Upload one to get started.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {documents.map((doc) => (
                            <div key={doc.name} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors group relative">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-900/20 text-blue-400 rounded-lg">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-200 truncate max-w-[200px]" title={doc.displayName}>
                                                {doc.displayName}
                                            </h4>
                                            <p className="text-xs text-gray-500 font-mono mt-1">
                                                {doc.name.split('/').pop()}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(doc.name); }}
                                        className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
