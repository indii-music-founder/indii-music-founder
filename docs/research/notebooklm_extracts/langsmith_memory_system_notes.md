# NotebookLM Extraction: LangSmith Memory System

**(Notebook Location: NotebookLM / "Architecting the LangSmith Agent Builder Memory System")**

I have comprehensively extracted all the coding-related information and high-quality concepts present in the text, as detailed below. (Note: These sources do not contain music industry specifics).

## 1. Coding-Related Information

**Infrastructure and Virtual Filesystem Architecture:**
The system does not use a real filesystem; instead, it stores files in a Postgres database and exposes them to the agent in the shape of a filesystem. This "virtual filesystem" approach provides the infrastructure efficiency and scalability of a database while leveraging Large Language Models' (LLMs) natural proficiency with filesystems. The storage layer is natively supported by the Deep Agents harness and is completely pluggable, allowing developers to substitute it with other storage options like S3 or MySQL.

**Harness and Abstraction:**
The platform is built on top of the Deep Agents harness, a generic agent framework. Deep Agents abstracts away complex context engineering tasks—such as summarization, tool call offloading, and planning—allowing developers to steer the agent with relatively simple configuration without needing a domain-specific language (DSL).

**File Formats and Conventions:**
The system relies heavily on markdown and JSON files to structure memory, specifically using:

* **AGENTS.md:** Used to define the core instruction set for the agent.
* **Agent skills files:** Used to provide specialized instructions for specific tasks.
* **tools.json:** A custom file used for Model Context Protocol (MCP) access. The developers deliberately chose a custom tools.json over the standard mcp.json to allow users to restrict the agent to a subset of tools within an MCP server, thereby avoiding context overflow.
* **subagents/ directory:** Used to define subagents using a format similar to Claude Code, such as a linkedin_search_worker.

**File Validation:**
To ensure custom file shapes are generated correctly (e.g., ensuring tools.json has valid MCP servers or skills files have proper frontmatter), the system utilizes an explicit validation step. If the agent generates an invalid file and validation fails, the system throws the errors back to the LLM rather than committing the broken file.

**Memory Operations and Commands:**
Currently, agents use standard tools like glob and grep to search their memories. In the future, the developers plan to expose an explicit `/remember` command to prompt the agent to reflect on a conversation and update its memory.

**Security:**
To minimize the potential attack vector of prompt injection, all memory edits require explicit human approval (human-in-the-loop) before updating, though users can bypass this by enabling "yolo mode."

**Portability:**
Because the agent's memory and configuration are simply standard files, the agents are highly portable and can be transferred to other agent harnesses like the Deep Agents CLI, Claude Code, or OpenCode, provided they share the same file conventions.

**Future Technical Implementations:**
Planned technical updates include adding semantic search capabilities over the memory, running background cron jobs (approximately once a day) to process memory outside of the active execution path, and exposing previous conversations as distinct files to establish episodic memory.

---

## 2. High-Quality Concepts

**Task-Specific Value of Memory:**
Unlike general-purpose agents (like ChatGPT or Claude) that perform a wide variety of unrelated tasks, LangSmith Agents are designed to repeat specific workflows over and over. Because the agent is doing the same task repeatedly, learnings from one session translate to the next at a much higher rate, making memory a critical component of the user experience.

**The COALA Memory Framework:**
The system's memory design is heavily influenced by the COALA paper, which categorizes agent memory into three distinct types:

* **Procedural Memory:** The set of rules applied to working memory to determine behavior (mapped to AGENTS.md and tools.json).
* **Semantic Memory:** Facts about the world (mapped to agent skills and other knowledge files).
* **Episodic Memory:** Sequences of the agent's past behavior (planned for the future via conversation files).

**"In the Hot Path" vs. Background Reflection:**
The concept of when an agent updates its memory is crucial. Currently, agents update their knowledge "in the hot path" (while actively running and completing tasks). However, a key limitation of hot-path updating is that agents often fail to recognize when to compact learnings—for example, generalizing that it should ignore all cold outreach rather than individually listing every single vendor it encounters. Implementing background reflection processes allows the agent to step back, catch patterns it missed in the moment, and effectively generalize specific instances into overarching rules.

**Iterative Agent Building via Natural Language:**
The memory system transforms the paradigm of how agents are built. Instead of requiring users to write perfect upfront documentation or manually update configuration files, the agent's AGENTS.md builds itself iteratively through natural language corrections. The user simply corrects the agent during standard interactions, and the agent permanently modifies its own specifications to handle edge cases, terminology, and formatting preferences.

**Prompting as the Primary Development Hurdle:**
A major conceptual takeaway from the engineering process was that the hardest part of building an agent with memory is prompting. In almost all cases where the agent performed poorly (e.g., remembering when it shouldn't, writing to the wrong files, or failing to format correctly), the solution was improving the system prompts rather than changing the underlying infrastructure.
