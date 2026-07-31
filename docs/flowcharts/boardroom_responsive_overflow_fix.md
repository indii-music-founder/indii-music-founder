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

## Architectural Root Cause & Fix Explanation

### Root Cause
In CSS Flexbox layout, the default `min-width` of a flex item (`flex-1`) is `auto`. When messages inside `BoardroomConversationPanel` contained wide formatted output (long file paths, code blocks, tables, or un-broken strings), the child content's intrinsic `scrollWidth` forced `flex-1` elements to expand horizontally. Since the left panel held a fixed `55%` width (`shrink-0`), the right panel expanded past the right edge of the viewport and never contracted back.

### Solution
1. **Flex Item Constraints (`min-w-0 min-h-0 overflow-hidden`)**: Applied explicit `min-w-0` and `overflow-hidden` constraints to all flex parents in `BoardroomModule`, `BoardroomConversationPanel`, and message rows.
2. **Text & Content Word Breaking**: Added `break-words`, `[overflow-wrap:anywhere]`, and `break-all` styling to the message container and text nodes.
3. **Markdown Block Overflow Handlers**: Added custom ReactMarkdown component handlers for `<pre>`, `<code>`, `<table>`, `<p>`, `<a>`, and `<img>` to enforce `max-w-full`, `overflow-x-auto`, and text-wrapping so wide code snippets or tables scroll internally rather than blowing out panel dimensions.
