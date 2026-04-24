/**
 * StreamingAgentCard Component
 *
 * Displays agent responses with token-by-token streaming animation.
 * Supports interruption, copy, and export functionality.
 */

import React, { useState } from 'react';
import { useAgentStream } from '@/hooks/useAgentStream';
import { Loader, Copy, Download, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import clsx from 'clsx';

interface StreamingAgentCardProps {
  agentId: string;
  input?: string;
  context?: Record<string, unknown>;
  onComplete?: (text: string) => void;
  onError?: (error: Error) => void;
  autoStart?: boolean;
  title?: string;
  className?: string;
}

export const StreamingAgentCard: React.FC<StreamingAgentCardProps> = ({
  agentId,
  input = '',
  context,
  onComplete,
  onError,
  autoStart = false,
  title = 'Agent Response',
  className = ''
}) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [expandedMetadata, setExpandedMetadata] = useState(false);

  const {
    isStreaming,
    fullText,
    tokens,
    error,
    stream,
    stop,
    reset,
    tokenCount
  } = useAgentStream(user?.uid || '', {
    onComplete: (metadata) => {
      onComplete?.(fullText);
    },
    onError: (err) => {
      onError?.(err);
    }
  });

  React.useEffect(() => {
    if (autoStart && input && !isStreaming) {
      stream(input, agentId, context);
    }
  }, [autoStart, input, agentId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(fullText)}`);
    element.setAttribute('download', `agent-response-${Date.now()}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className={clsx(
      'rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {isStreaming && (
            <Loader className="h-4 w-4 animate-spin text-blue-500" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {fullText && (
            <>
              <button
                onClick={handleCopy}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title="Copy to clipboard"
              >
                <Copy className={clsx('h-4 w-4', copied ? 'text-green-600' : 'text-gray-600')} />
              </button>
              <button
                onClick={handleExport}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title="Export as text file"
              >
                <Download className="h-4 w-4 text-gray-600" />
              </button>
            </>
          )}
          {isStreaming && (
            <button
              onClick={stop}
              className="p-1.5 hover:bg-red-50 rounded transition-colors"
              title="Stop streaming"
            >
              <X className="h-4 w-4 text-red-600" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {error ? (
          <div className="rounded bg-red-50 p-3 text-red-700 text-sm">
            <p className="font-semibold">Error</p>
            <p>{error.message}</p>
            <button
              onClick={reset}
              className="mt-2 text-red-600 hover:text-red-800 underline text-sm"
            >
              Try again
            </button>
          </div>
        ) : fullText ? (
          <div className="prose prose-sm max-w-none text-gray-900 whitespace-pre-wrap break-words">
            {fullText}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse" />
            )}
          </div>
        ) : isStreaming ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Streaming response...</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No response yet</p>
            {input ? (
              <button
                onClick={() => stream(input, agentId, context)}
                className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
              >
                Start Streaming
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer with Metadata */}
      {(tokenCount > 0 || isStreaming) && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
          <button
            onClick={() => setExpandedMetadata(!expandedMetadata)}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 w-full"
          >
            <span>Tokens: {tokenCount}</span>
            <span>•</span>
            <span>Status: {isStreaming ? 'Streaming' : 'Complete'}</span>
          </button>
          {expandedMetadata && (
            <div className="mt-2 text-xs text-gray-600 space-y-1">
              <div>Agent: {agentId}</div>
              <div>Tokens generated: {tokenCount}</div>
              {input && <div>Input length: {input.length} chars</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
