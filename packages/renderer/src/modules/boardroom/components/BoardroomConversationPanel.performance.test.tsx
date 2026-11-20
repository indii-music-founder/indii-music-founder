import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPersonaResponseRender = vi.hoisted(() => vi.fn());
const mockMarkdownRender = vi.hoisted(() => vi.fn());
const mockThoughtChainRender = vi.hoisted(() => vi.fn());

vi.mock("motion/react", () => ({
  motion: {
    div: React.forwardRef(
      (
        {
          children,
          ...props
        }: React.PropsWithChildren<Record<string, unknown>>,
        ref: React.Ref<HTMLDivElement>,
      ) => {
        const filtered = Object.fromEntries(
          Object.entries(props).filter(
            ([key]) =>
              !["initial", "animate", "exit", "transition"].includes(key),
          ),
        );
        return (
          <div ref={ref} {...filtered}>
            {children}
          </div>
        );
      },
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock("@/core/components/command-bar/PromptArea", () => ({
  PromptArea: () => <div data-testid="prompt-area" />,
}));

vi.mock("@/core/components/chat/PersonaResponseActions", () => ({
  PersonaResponseActions: () => {
    mockPersonaResponseRender();
    return <div data-testid="persona-response-actions" />;
  },
}));

vi.mock("@/core/components/chat/ThoughtChain", () => ({
  ThoughtChain: () => {
    mockThoughtChainRender();
    return <div data-testid="thought-chain" />;
  },
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    (mockMarkdownRender(), <div>{children}</div>)
  ),
}));
vi.mock("remark-gfm", () => ({ default: vi.fn() }));
vi.mock("@/components/motion-primitives/text-effect", () => ({
  TextEffect: ({ children }: React.PropsWithChildren) => (
    <span>{children}</span>
  ),
}));

import { BoardroomConversationPanel } from "./BoardroomConversationPanel";

describe("BoardroomConversationPanel message rendering", () => {
  beforeEach(() => {
    mockPersonaResponseRender.mockClear();
    mockMarkdownRender.mockClear();
    mockThoughtChainRender.mockClear();
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  it("does not rerender completed message actions when another agent streams a token", () => {
    const completedMessage = {
      id: "completed",
      role: "model" as const,
      text: "Finished response",
      timestamp: 1,
      agentId: "marketing",
      isStreaming: false,
      thoughts: [{ id: 'thought-1', type: 'logic' as const, text: 'Planning', timestamp: 1 }],
    };
    const firstStreamedMessage = {
      id: "streaming",
      role: "model" as const,
      text: "A",
      timestamp: 2,
      agentId: "finance",
      isStreaming: true,
    };
    const { rerender } = render(
      <BoardroomConversationPanel
        messages={[completedMessage, firstStreamedMessage]}
      />,
    );

    expect(mockPersonaResponseRender).toHaveBeenCalledTimes(1);
    expect(mockMarkdownRender).toHaveBeenCalledTimes(2);
    expect(mockThoughtChainRender).toHaveBeenCalledTimes(1);

    rerender(
      <BoardroomConversationPanel
        messages={[completedMessage, { ...firstStreamedMessage, text: "AB" }]}
      />,
    );

    expect(mockPersonaResponseRender).toHaveBeenCalledTimes(1);
    expect(mockMarkdownRender).toHaveBeenCalledTimes(3);
    expect(mockThoughtChainRender).toHaveBeenCalledTimes(1);
  });
});
