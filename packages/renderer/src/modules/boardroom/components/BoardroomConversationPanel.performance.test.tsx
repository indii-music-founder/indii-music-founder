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

  it("keeps row 0 render count at 1 across 10 tail streaming updates in a 30-message conversation", () => {
    const firstMessage = {
      id: "msg-0",
      role: "model" as const,
      text: "Opening summary",
      timestamp: 1,
      agentId: "legal",
      isStreaming: false,
      thoughts: [{ id: "t-0", type: "logic" as const, text: "Initial check", timestamp: 1 }],
    };
    const middleMessages = Array.from({ length: 28 }, (_, index) => ({
      id: `msg-${index + 1}`,
      role: "model" as const,
      text: `Update ${index + 1}`,
      timestamp: index + 2,
      agentId: "marketing",
      isStreaming: false,
    }));
    const tailMessage = {
      id: "msg-29",
      role: "model" as const,
      text: "Token 0",
      timestamp: 30,
      agentId: "finance",
      isStreaming: true,
    };

    const { rerender } = render(
      <BoardroomConversationPanel
        messages={[firstMessage, ...middleMessages, tailMessage]}
      />,
    );

    expect(mockThoughtChainRender).toHaveBeenCalledTimes(1);
    expect(mockPersonaResponseRender).toHaveBeenCalledTimes(29);
    expect(mockMarkdownRender).toHaveBeenCalledTimes(30);

    for (let step = 1; step <= 10; step += 1) {
      rerender(
        <BoardroomConversationPanel
          messages={[
            firstMessage,
            ...middleMessages,
            { ...tailMessage, text: `Token ${step}` },
          ]}
        />,
      );
    }

    // Row 0's ThoughtChain and all 29 completed PersonaResponseActions must not rerender
    expect(mockThoughtChainRender).toHaveBeenCalledTimes(1);
    expect(mockPersonaResponseRender).toHaveBeenCalledTimes(29);
    // Only the 10 tail updates re-rendered Markdown
    expect(mockMarkdownRender).toHaveBeenCalledTimes(40);
  });

  it("rerenders PersonaResponseActions when a completed message receives a metadata-only update", () => {
    const completed = {
      id: "meta-msg",
      role: "model" as const,
      text: "Verified royalty breakdown",
      timestamp: 10,
      agentId: "finance",
      isStreaming: false,
      metadata: { verificationLabel: "Initial" },
    };

    const { rerender } = render(<BoardroomConversationPanel messages={[completed]} />);
    expect(mockPersonaResponseRender).toHaveBeenCalledTimes(1);

    rerender(
      <BoardroomConversationPanel
        messages={[
          {
            ...completed,
            metadata: { verificationLabel: "Updated" },
          },
        ]}
      />,
    );

    expect(mockPersonaResponseRender).toHaveBeenCalledTimes(2);
  });

  it("clears the user waiting pulse animation once agent streaming finishes", () => {
    const userMessage = {
      id: "user-1",
      role: "user" as const,
      text: "Audit this split sheet",
      timestamp: 1,
    };
    const modelStreaming = {
      id: "model-1",
      role: "model" as const,
      text: "Checking...",
      timestamp: 2,
      agentId: "legal",
      isStreaming: true,
    };

    const { container, rerender } = render(
      <BoardroomConversationPanel messages={[userMessage, modelStreaming]} />,
    );

    const avatarWhileStreaming = container.querySelector('[data-testid="user-avatar-user-1"]');
    expect(avatarWhileStreaming?.className).toContain("motion-safe:animate-pulse");
    expect(avatarWhileStreaming?.querySelector("span.motion-safe\\:animate-ping")).not.toBeNull();

    rerender(
      <BoardroomConversationPanel
        messages={[userMessage, { ...modelStreaming, isStreaming: false, text: "Done." }]}
      />,
    );

    const avatarAfterDone = container.querySelector('[data-testid="user-avatar-user-1"]');
    expect(avatarAfterDone?.className).not.toContain("animate-pulse");
    expect(avatarAfterDone?.querySelector("span.motion-safe\\:animate-ping")).toBeNull();
  });
});
