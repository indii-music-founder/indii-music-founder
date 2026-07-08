import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import type { OrgAdapter, CatalogTrack } from '../types';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';

interface RegistrationAutonomousRailProps {
  focusedAdapter: OrgAdapter | null;
  track: CatalogTrack | null;
  className?: string;
}

import { AgentMessage } from '@/core/store/slices/agent';

export function RegistrationAutonomousRail({ focusedAdapter, track, className }: RegistrationAutonomousRailProps) {
  const { registrationIntelligenceMessage, setRegistrationIntelligenceMessage, sessions, createSession, addMessageToSession } = useStore(
    useShallow(s => ({
      registrationIntelligenceMessage: s.registrationIntelligenceMessage,
      setRegistrationIntelligenceMessage: s.setRegistrationIntelligenceMessage,
      sessions: s.sessions,
      createSession: s.createSession,
      addMessageToSession: s.addMessageToSession
    }))
  );

  const namespace = `registration-rail-${track?.id || 'global'}`;
  const railSession = Object.values(sessions).find(s => s.namespace === namespace);
  const messages = railSession?.messages || [];

  const [input, setInput] = useState('');
  const [isActive, setIsActive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);


  // Helper to ensure session exists before adding messages
  const ensureSessionAndAddMessage = (msg: AgentMessage) => {
    let activeSessionId = railSession?.id;
    if (!activeSessionId) {
      activeSessionId = createSession(
        `Registration: ${track?.title || 'Global'}`,
        ['indii-registration'],
        namespace
      );
    }
    addMessageToSession(activeSessionId, msg);
  };

  // Consume one-shot message from store (pushed by AgentOrchestrator / navigate_to)
  useEffect(() => {
    if (registrationIntelligenceMessage) {
      ensureSessionAndAddMessage({ id: Date.now().toString(), role: 'model', text: registrationIntelligenceMessage, timestamp: Date.now() });
      setIsActive(true);
      setRegistrationIntelligenceMessage('');
    }
  }, [registrationIntelligenceMessage, setRegistrationIntelligenceMessage]);

  // Greet when a new org is focused
  useEffect(() => {
    if (focusedAdapter && track) {
      const greeting = buildGreeting(focusedAdapter, track);
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.text !== greeting) {
        ensureSessionAndAddMessage({ id: Date.now().toString(), role: 'model', text: greeting, timestamp: Date.now() });
      }
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
    ensureSessionAndAddMessage({ id: Date.now().toString(), role: 'user', text, timestamp: Date.now() });

    try {
      const systemPrompt = focusedAdapter
        ? `You are indii, a creative assistant. The user is filling out the ${focusedAdapter.name} registration form for "${track?.title}". Answer concisely with relevant music industry knowledge.`
        : 'You are indii, a creative assistant in the Registration Center. Answer concisely.';

      const replyText = await AutonomousIntelligence.generateText(
        text,
        INTELLIGENCE_MODELS.TEXT.FAST,
        systemPrompt
      );
      ensureSessionAndAddMessage({ id: Date.now().toString(), role: 'model', text: replyText || "I'm here — ask me anything about this registration.", timestamp: Date.now() });
    } catch {
      ensureSessionAndAddMessage({ id: Date.now().toString(), role: 'model', text: "I'm here — ask me anything about this registration.", timestamp: Date.now() });
    }
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2 flex-shrink-0">
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center',
          isActive ? 'bg-green-500/30 animate-pulse' : 'bg-white/[0.06]'
        )}>
          <Bot size={13} className="text-green-400" />
        </div>
        <span className="text-xs font-semibold text-gray-300">indii Co-Pilot</span>
        {isActive && (
          <span className="text-[10px] text-green-400 ml-auto flex items-center gap-1">
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
            key={msg.id}
            className={cn(
              'text-xs leading-relaxed rounded-xl px-3 py-2.5 max-w-[90%]',
              msg.role !== 'user'
                ? 'bg-green-500/10 border border-green-500/20 text-green-100/90'
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
            className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-green-500/30"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
