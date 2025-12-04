# Component Kit Research & Implementation Guide

This document provides a detailed analysis of three modern UI component libraries—**Prompt Kit**, **Motion Primitives**, and **Kokonut UI**—and outlines how they can be leveraged to enhance the **Rndr-AI-v1** application.

## Executive Summary

* **Prompt Kit**: Best for **AI-specific interactions** (chat interfaces, prompt inputs). It abstracts the complexity of building robust chat UIs.
* **Motion Primitives**: Best for **high-end animations** and "delight" details. It uses `motion` (Framer Motion) to add professional polish.
* **Kokonut UI**: Best for **complex, pre-designed UI blocks** (cards, search bars, buttons). It offers "drop-in" stunning components that save significant design time.

---

## 1. Prompt Kit

**URL**: [https://www.prompt-kit.com/](https://www.prompt-kit.com/)

### Overview

A library of customizable components specifically built for AI applications. It is built on top of `shadcn/ui` and `tailwindcss`, making it fully compatible with our current stack.

### Installation

Since we are using `shadcn/ui`, installation is seamless via the CLI.

```bash
# Example: Installing the Prompt Input component
npx shadcn@latest add "https://prompt-kit.com/c/prompt-input.json"
```

**Prerequisites**:

* `shadcn/ui` configured (Already present in project)
* `tailwindcss` (Already present)

### Key Components for Rndr-AI-v1

#### `PromptInput`

* **Description**: A sophisticated textarea wrapper designed for AI prompts. It likely handles auto-resizing, submit-on-enter, and integrating actions (like attachments).
* **Use Case**: Replace the current raw input fields in the **Assistant** and **Orchestrator** views.
* **Benefit**: Standardizes the "talk to AI" experience across the app.

#### `ChatContainer` & `Message`

* **Description**: Components to structure the chat history, distinguishing between user and AI messages with proper styling.
* **Use Case**: Refactor the main chat view in `src/app/assistant/page.tsx` (or equivalent) to use these for a more robust layout.

### Integration Strategy

1. **Audit**: Identify all places where a user inputs text for an AI agent.
2. **Replace**: Swap standard `<textarea>` or `<input>` elements with `PromptInput`.
3. **Extend**: Use `PromptInputActions` to add the "File Upload" and "Voice Input" features we plan to support.

---

## 2. Motion Primitives

**URL**: [https://motion-primitives.com/](https://motion-primitives.com/)

### Overview

A collection of copy-paste components focused on animation, built with `motion` (formerly Framer Motion) and Tailwind CSS. It provides the "wow" factor through micro-interactions.

### Installation

```bash
# Install core dependencies
npm install motion clsx tailwind-merge lucide-react

# Add the utility helper (if not already present in lib/utils.ts)
# ... standard cn() function ...

# Add a component
npx motion-primitives@latest add text-effect
```

### Key Components for Rndr-AI-v1

#### `TextEffect`

* **Description**: Animates text per character, word, or line.
* **Use Case**:
  * **Streaming Responses**: Animate the AI's response as it streams in (e.g., a smooth fade-in or typewriter effect).
  * **Headlines**: Animate section headers in the **Dashboard** or **Landing Page**.

#### `Toolbar` / `Dynamic Containers`

* **Description**: Smoothly expanding/collapsing containers.
* **Use Case**: The "Command Bar" or "Quick Actions" menu. When a user clicks a tool, the container can morph to show options.

### Integration Strategy

1. **Enhance AI Responses**: Wrap the AI response text in `TextEffect` for a premium feel.
2. **Loading States**: Replace static spinners with motion-based loading indicators (if available in the kit or custom-built using their patterns).
3. **Transitions**: Use their primitives to animate page transitions or modal openings.

---

## 3. Kokonut UI

**URL**: [https://kokonutui.com/](https://kokonutui.com/)

### Overview

A collection of 100+ "stunning" UI components. These are often more complex, composed components (like a full "AI Input Search" block) rather than atomic primitives.

### Installation

Kokonut UI uses a registry system compatible with `shadcn/ui`.

```bash
# 1. Initialize (if needed, but we likely just need to add the registry)
# Add to components.json:
# "registries": { "@kokonutui": "https://kokonutui.com/r/{name}.json" }

# 2. Install a component
npx shadcn@latest add @kokonutui/ai-input-search
```

**Dependencies**:

* Tailwind CSS v4 (Project uses v4)
* `lucide-react`

### Key Components for Rndr-AI-v1

#### `AI Input Search`

* **Description**: A rich input field with integrated search/command capabilities.
* **Use Case**: The global **Command Bar**. This could be the "One Bar to Rule Them All" that the user requested for consolidating inputs.

#### `File Upload`

* **Description**: A polished file drop zone.
* **Use Case**: **Urgent**. The user specifically requested improvements to the file drop UI. Kokonut's implementation is likely far superior to a basic HTML input.

#### `Card` / `Bento Grid`

* **Description**: Modern, glassmorphic or highly styled cards.
* **Use Case**: The **Dashboard** layout. Displaying "Agents", "Recent Projects", or "Stats" in a Bento Grid layout would look very professional.

### Integration Strategy

1. **Immediate Win**: Implement the **File Upload** component to solve the current "Improve file drop UI" task.
2. **Global Navigation**: Evaluate `AI Input Search` as the replacement for the current Command Bar.
3. **Dashboard Revamp**: Use `Bento Grid` or `Card` components to redesign the main landing view.

---

## Summary Action Plan

1. **Setup**: Ensure `components.json` is configured to allow the `@kokonutui` registry.
2. **Pilot**:
    * Install **Prompt Kit's `PromptInput`** and test it in the Assistant view.
    * Install **Kokonut UI's `File Upload`** and replace the current drop zone.
3. **Polish**:
    * Install **Motion Primitives** and add `TextEffect` to the AI welcome message.
