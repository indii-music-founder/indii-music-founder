# Boardroom Responsive Overflow & Layout Containment Architecture

```mermaid
flowchart TD
    subgraph BoardroomModule["BoardroomModule (Portal Container)"]
        A["Split-Panel flex container (min-h-0 overflow-hidden)"] --> B["Left: Orbital Table (w-[55%] shrink-0)"]
        A --> C["Right: Discussion Panel Container (flex-1 min-w-0 min-h-0 overflow-hidden)"]
    end

    subgraph RightPanel["Right Panel Component Stack"]
        C --> D["HarnessDecisionDigest (shrink-0 min-w-0)"]
        C --> E["BoardroomConversationPanel (flex-1 min-w-0 min-h-0 overflow-hidden)"]
        E --> F["Panel Header (shrink-0 min-w-0)"]
        E --> G["Scrollable Message List (flex-1 min-w-0 overflow-y-auto overflow-x-hidden)"]
        E --> H["PromptArea Docked Footer (shrink-0 min-w-0)"]
    end

    subgraph MessageItem["Message Item & Content Formatting"]
        G --> I["Message Row (flex min-w-0 max-w-full)"]
        I --> J["Agent / User Avatar (shrink-0)"]
        I --> K["Content Wrapper (flex-1 min-w-0 max-w-full overflow-hidden)"]
        K --> L["ReactMarkdown Container (break-words [overflow-wrap:anywhere])"]
        L --> M["<pre> Blocks (max-w-full overflow-x-auto whitespace-pre-wrap break-all)"]
        L --> N["<code> Inline (break-all)"]
        L --> O["<table> Wrappers (max-w-full overflow-x-auto)"]
    end
```

## Step-by-Step Transition Breakdown

1. **BoardroomModule Layout**: The split-panel flex container locks the left orbital table at 55% width and delegates the remaining space to the discussion panel with strict `min-w-0 min-h-0 overflow-hidden` bounds.
2. **Right Panel Hierarchy**: The right panel stacks the decision digest, conversation header, scrollable message feed, and docked prompt footer with `shrink-0` and `flex-1` bounds.
3. **Message List Containment**: The scrollable list enforces `overflow-y-auto overflow-x-hidden` so vertical scrolling occurs cleanly without horizontal blowout.
4. **Message Formatting & Overflow Control**: Markdown text nodes use `break-words` and `[overflow-wrap:anywhere]`, while code blocks and tables use internal `overflow-x-auto` wrappers.
