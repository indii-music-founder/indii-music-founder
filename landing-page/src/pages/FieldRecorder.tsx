import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, StopCircle, RefreshCw, Cloud, AlertCircle,
  Play, Pause, Trash2, Check, Music, Layout, ChevronLeft
} from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { auth, db, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';

type RecordingState = 'idle' | 'recording' | 'stopped' | 'uploading' | 'completed';

export default function FieldRecorder() {
  const { user } = useAuth();
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingState === 'idle') setTimer(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [recordingState]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setRecordingState('recording');
      setError(null);
    } catch (err) {
      setError('Microphone access denied or unsupported browser.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecordingState('stopped');
  }

  async function handleUpload() {
    if (!user || !audioBlob || !storage || !db) {
      setError('You must be logged in to sync with the cloud.');
      return;
    }

    setRecordingState('uploading');
    const filename = title || `Recording_${new Date().toISOString()}`;
    const storagePath = `users/${user.uid}/recordings/${Date.now()}_${filename}.webm`;
    const storageRef = ref(storage, storagePath);

    try {
      // 1. Upload to Storage
      const snapshot = await uploadBytes(storageRef, audioBlob);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      // 2. Register in Firestore (Shared with Electron App)
      await addDoc(collection(db, 'history'), {
        userId: user.uid,
        orgId: 'personal',
        type: 'audio_capture',
        prompt: filename,
        storageUrl: downloadUrl,
        mimeType: 'audio/webm',
        createdAt: serverTimestamp(),
        generatedAt: Date.now(),
        estimatedDuration: timer,
        metadata: {
          source: 'Artist Portal (Field Recorder)',
          originalFilename: filename
        }
      });

      setRecordingState('completed');
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Cloud sync failed. Please try again or download locally.');
      setRecordingState('stopped');
    }
  }

  function reset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingState('idle');
    setTimer(0);
    setTitle('');
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-purple-500/30 overflow-hidden relative">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-purple-500/10 to-transparent pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-purple-600/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Navigation */}
      <nav className="absolute top-0 left-0 w-full p-6 flex items-center justify-between z-10 backdrop-blur-md border-b border-white/5">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="p-2 bg-white/5 rounded-lg border border-white/10 group-hover:border-purple-500/50 transition-all">
            <ChevronLeft size={16} className="text-gray-400 group-hover:text-purple-400" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">Exit Studio</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${recordingState === 'recording' ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-green-500'}`} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            {recordingState === 'recording' ? 'Live Capture' : 'Secure Bridge'}
          </span>
        </div>
      </nav>

      <main className="relative z-1 container max-w-lg mx-auto min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-12">
        <header className="text-center mb-12 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-4">
            <Mic size={12} className="text-purple-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Artist Voice Portal</span>
          </div>
          <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none">
            Field <span className="text-purple-500">Capture</span>
          </h1>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.3em]">indiiOS Professional Audio Interface</p>
        </header>

        <div className="w-full space-y-8 flex flex-col items-center">
          {/* Visualizer / Timer Display */}
          <div className="relative w-full aspect-video bg-white/5 border border-white/10 rounded-[32px] flex flex-col items-center justify-center overflow-hidden backdrop-blur-3xl shadow-2xl">
            {recordingState === 'recording' && (
              <div className="absolute inset-x-0 bottom-0 h-1/2 flex items-end justify-center gap-1.5 px-8 pb-12">
                {[...Array(24)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [10, Math.random() * 60 + 20, 10] }}
                    transition={{ repeat: Infinity, duration: 0.5 + Math.random() * 0.5 }}
                    className="w-1 bg-purple-500 rounded-full"
                  />
                ))}
              </div>
            )}

            <div className="text-7xl font-mono font-black tracking-tighter tabular-nums mb-2">
              {formatTime(timer)}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              {recordingState === 'recording' ? 'Streaming to Buffer' : 'Ready to capture'}
            </span>
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center gap-8 w-full">
            <AnimatePresence mode="wait">
              {recordingState === 'idle' && (
                <motion.button
                  key="record"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.2, opacity: 0 }}
                  onClick={startRecording}
                  className="relative group"
                >
                  <div className="absolute -inset-4 bg-red-600/20 blur-2xl rounded-full group-hover:bg-red-600/30 transition-all animate-pulse" />
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-red-600 to-red-900 border-4 border-white/10 flex items-center justify-center shadow-2xl relative">
                    <Mic size={40} className="text-white fill-white/20" />
                  </div>
                  <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-widest text-gray-500">Initialize</span>
                </motion.button>
              )}

              {recordingState === 'recording' && (
                <motion.button
                  key="stop"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.2, opacity: 0 }}
                  onClick={stopRecording}
                  className="relative group"
                >
                  <div className="absolute -inset-4 bg-white/20 blur-2xl rounded-full animate-pulse" />
                  <div className="w-32 h-32 rounded-full bg-white border-4 border-white/10 flex items-center justify-center shadow-2xl relative">
                    <StopCircle size={40} className="text-black" />
                  </div>
                </motion.button>
              )}

              {(recordingState === 'stopped' || recordingState === 'uploading' || recordingState === 'completed') && (
                <motion.div
                  key="actions"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="w-full space-y-6"
                >
                  {recordingState === 'stopped' && (
                    <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Asset Title</label>
                        <input
                          type="text"
                          placeholder="Capture name..."
                          value={title}
                          onChange={e => setTitle(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold placeholder:text-gray-700 focus:outline-none focus:border-purple-500/50 transition-all italic tracking-tight"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={handleUpload}
                          disabled={!user}
                          className={`py-5 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs transition-all ${user ? 'bg-purple-600 hover:bg-purple-500 shadow-xl shadow-purple-950/20' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
                        >
                          <Cloud size={16} />
                          Sync Cloud
                        </button>
                        <a
                          href={audioUrl || ''}
                          download={`${title || 'field-recording'}.webm`}
                          className="py-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all"
                        >
                          <Layout size={16} />
                          Export
                        </a>
                      </div>
                      {!user && (
                        <p className="flex items-center gap-1.5 text-[9px] font-bold text-amber-500/80 uppercase tracking-tight justify-center">
                          <AlertCircle size={10} />
                          Sign in to sync with indiiOS Studio
                        </p>
                      )}
                    </div>
                  )}

                  {recordingState === 'uploading' && (
                    <div className="w-full py-12 flex flex-col items-center gap-6">
                      <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                      <p className="text-sm font-black uppercase tracking-widest italic animate-pulse">Establishing Bridge...</p>
                    </div>
                  )}

                  {recordingState === 'completed' && (
                    <div className="w-full py-8 flex flex-col items-center gap-6 animate-in zoom-in-95 duration-500">
                      <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/50 flex items-center justify-center text-green-500">
                        <Check size={32} strokeWidth={3} />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-lg font-black italic uppercase tracking-tighter">Capture Synced</p>
                        <p className="text-xs text-gray-500 font-medium">Available now in your Studio library.</p>
                      </div>
                      <button
                        onClick={reset}
                        className="mt-4 px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        New Session
                      </button>
                    </div>
                  )}

                  {recordingState === 'stopped' && (
                    <button
                      onClick={reset}
                      className="w-full py-3 text-[10px] font-black text-gray-600 hover:text-red-500 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 group"
                    >
                      <Trash2 size={12} />
                      Discard Session
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-bold italic"
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 w-full p-8 flex items-center justify-between pointer-events-none opacity-40">
        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-600">ALPHA_V5.0</span>
        <div className="flex items-center gap-4">
          <span className="text-[9px] font-bold text-gray-700">POWERED BY GEMINI 3 CORTEX</span>
        </div>
      </footer>
    </div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <RefreshCw className={className} />
);
