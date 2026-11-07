import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveConversationButton } from './LiveConversationButton';
import { useStore } from '@/core/store';
import { liveConversationService } from '@/services/intelligence/LiveConversationService';

vi.mock('@/services/intelligence/LiveConversationService', () => ({
  liveConversationService: {
    startSession: vi.fn().mockResolvedValue(true),
    stopSession: vi.fn().mockResolvedValue(undefined),
    handlePrimaryAction: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('LiveConversationButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      isLiveConversationActive: false,
      liveConversationPhase: 'idle',
      activeSpeakingAgentId: null,
      directTargetAgentId: null,
      activeDepartmentId: null,
      agentVoiceOverrides: {},
    });
  });

  it('renders in idle state with correct aria-label and icon', () => {
    render(<LiveConversationButton />);
    const button = screen.getByTestId('live-conversation-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Two-Way Conversation');
    expect(button).toHaveAttribute('title', 'Start two-way conversation');
  });

  it('calls startSession or handlePrimaryAction when clicked in idle state', async () => {
    render(<LiveConversationButton />);
    const button = screen.getByTestId('live-conversation-button');
    fireEvent.click(button);
    expect(liveConversationService.startSession).toHaveBeenCalledTimes(1);
  });

  it('renders active listening state with End Two-Way Conversation aria-label', () => {
    useStore.setState({
      isLiveConversationActive: true,
      liveConversationPhase: 'listening',
      activeSpeakingAgentId: null,
    });

    render(<LiveConversationButton />);
    const button = screen.getByTestId('live-conversation-button');
    expect(button).toHaveAttribute('aria-label', 'End Two-Way Conversation');
    expect(button).toHaveAttribute('title', 'Listening… (click to end)');
  });

  it('renders speaking state with correct title', () => {
    useStore.setState({
      isLiveConversationActive: true,
      liveConversationPhase: 'speaking',
      activeSpeakingAgentId: 'producer',
    });

    render(<LiveConversationButton />);
    const button = screen.getByTestId('live-conversation-button');
    expect(button).toHaveAttribute('title', 'Speaking (Production Director)… click to interrupt');
  });

  it('calls handlePrimaryAction when clicked in active state', () => {
    useStore.setState({
      isLiveConversationActive: true,
      liveConversationPhase: 'listening',
    });

    render(<LiveConversationButton />);
    const button = screen.getByTestId('live-conversation-button');
    fireEvent.click(button);
    expect(liveConversationService.handlePrimaryAction).toHaveBeenCalledTimes(1);
  });

  it('applies custom className and sizeVariant', () => {
    render(<LiveConversationButton sizeVariant="docked" className="custom-class" />);
    const button = screen.getByTestId('live-conversation-button');
    expect(button.className).toContain('custom-class');
  });
});
