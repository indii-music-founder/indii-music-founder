import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import type { OrgAdapter, CatalogTrack } from '../types';
import { GenAI } from '@/services/ai/GenAI';
import { AI_MODELS } from '@/core/config/ai-models';

interface RegistrationAIRailProps {
  focusedAdapter: OrgAdapter | null;
  track: CatalogTrack | null;
  className?: string;
}

interface AIMessage {
  role: 'ai' | 'user';
  text: string;
  ts: number;
}

export function RegistrationAIRail({ focusedAdapter, track, className }: RegistrationAIRailProps) {
  const { registrationAIMessage, setRegistrationAIMessage } = useStore(
    useShallow(s => ({
      registrationAIMessage: s.registrationAIMessage,
      setRegistrationAIMessage: s.setRegistrationAIMessage,
    }))
  );

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isActive, setIsActive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);


  // Consume one-shot message from store (pushed by AgentOrchestrator / navigate_to)
  useEffect(() => {
    if (registrationAIMessage) {
      setMessages(prev => [...prev, { role: 'ai', text: registrationAIMessage, ts: Date.now() }]);
      setIsActive(true);
      setRegistrationAIMessage('');
    }
  }, [registrationAIMessage, setRegistrationAIMessage]);

  // Greet when a new org is focused — intentionally keyed by .id to avoid
  // duplicate greetings on every shallow prop reference change.
  useEffect(() => {
    if (focusedAdapter && track) {
      const greeting = buildGreeting(focusedAdapter, track);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.text === greeting) return prev;
        return [...prev, { role: 'ai', text: greeting, ts: Date.now() }];
      });
      setIsActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedAdapter?.id, track?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text, ts: Date.now() }]);

    try {
      const systemPrompt = focusedAdapter
        ? `You are indii, a creative assistant. The user is filling out the ${focusedAdapter.name} registration form for "${track?.title}". Answer concisely with relevant music industry knowledge.`
        : 'You are indii, a creative assistant in the Registration Center. Answer concisely.';

      const replyText = await GenAI.generateText(
        text,
        AI_MODELS.TEXT.FAST,
        systemPrompt
      );
      setMessages(prev => [...prev, { role: 'ai', text: replyText || "I'm here — ask me anything about this registration.", ts: Date.now() }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: "I'm here — ask me anything about this registration.", ts: Date.now() },
      ]);
    }
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2 flex-shrink-0">
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center',
          isActive ? 'bg-purple-500/30 animate-pulse' : 'bg-white/[0.06]'
        )}>
          <Bot size={13} className="text-purple-400" />
        </div>
        <span className="text-xs font-semibold text-gray-300">indii Co-Pilot</span>
        {isActive && (
          <span className="text-[10px] text-purple-400 ml-auto flex items-center gap-1">
            <Sparkles size={10} />
            Active
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-xs text-gray-600 mt-8 px-4">
            <Bot size={20} className="mx-auto mb-2 opacity-30" />
            <p>Select a track and an organization to get started. I'll pre-fill what I know and only ask for what I don't.</p>
          </div>
        )}
        {messages.map(msg => (
          <div
            key={msg.ts}
            className={cn(
              'text-xs leading-relaxed rounded-xl px-3 py-2.5 max-w-[90%]',
              msg.role === 'ai'
                ? 'bg-purple-500/10 border border-purple-500/20 text-purple-100/90'
                : 'bg-white/[0.04] border border-white/[0.06] text-gray-200 ml-auto'
            )}
          >
            {msg.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.05] flex-shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask anything about this registration…"
            className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-purple-500/30"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function buildGreeting(adapter: OrgAdapter, track: CatalogTrack): string {
  const gapCount = adapter.fields.filter(f => f.required && !f.autoFillFrom).length;
  const autoCount = adapter.fields.filter(f => f.autoFillFrom).length;
  if (gapCount === 0) {
    return `I can complete your ${adapter.name} registration for "${track.title}" entirely from your catalog data. Review and hit Submit when ready.`;
  }
  return `For ${adapter.name} registration of "${track.title}", I've pre-filled ${autoCount} field${autoCount !== 1 ? 's' : ''} from your catalog. I just need ${gapCount} thing${gapCount !== 1 ? 's' : ''} from you — highlighted above.`;
}
