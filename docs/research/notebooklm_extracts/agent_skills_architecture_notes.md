# NotebookLM Extraction: Agent Skills

**(Notebook Location: NotebookLM / "Agent Skills: Architecture, Specifications, and Implementation Standards")**

Based on the provided sources, here is a comprehensive extraction of all coding-related information, music industry details, and high-quality concepts.

## 1. Music Industry & Audio Details

The sources are overwhelmingly focused on AI software architecture, but they contain a few brief mentions of audio and music integrations:

* **Creative Skills:** Anthropic’s public repository for Agent Skills includes examples for creative applications, specifically noting "art, music, design".
* **API Connections:** AI Agent tools can connect to music streaming APIs like Spotify to retrieve information.
* **Audio Models & Frameworks:** OpenAI's API dashboard features categories for "Audio and speech," "Text to speech," "Speech to text," and a "Realtime API" that connects via WebRTC, WebSocket, or SIP for voice agents. Additionally, Microsoft's Semantic Kernel supports audio processing, highlighted in their documentation update "Working with Audio in Semantic Kernel Python".

---

## 2. High-Quality Concepts & Architectural Paradigms

#### Agent Skills vs. Tools vs. Model Context Protocol (MCP)

* **Tools:** Executable functions with defined inputs, outputs, and side effects (the "hands" of the agent). Tools operate outside the model, extending capability (e.g., fetching a URL, querying a database).
* **Model Context Protocol (MCP):** An open standard client-server protocol (using JSON-RPC 2.0) that standardizes how agents discover and invoke external tools and resources. It provides process isolation, scoped credentials, and deterministic execution.
* **Agent Skills:** Packaged procedural expertise, workflows, and behavioral patterns that shape how an agent thinks (the "brains" or "training"). Skills sit in the knowledge/context layer, extending competence. They are stored as folders containing SKILL.md instructions, scripts, and reference files.

#### Progressive Disclosure

Progressive disclosure is a tiered context management architecture designed to prevent context window exhaustion (token bloat) and reduce cognitive load.

* **Level 1 (Discovery):** At startup, the agent only pre-loads the name and description of the skill from the YAML frontmatter (approx. 30-100 tokens).
* **Level 2 (Activation):** When the agent's task semantically matches the skill description, the agent uses a tool to read the full SKILL.md body into its context window (typically under 5,000 tokens).
* **Level 3 (Execution):** If the instructions require it, the agent will dynamically load heavy reference files, templates, or execute scripts on demand. Code from executed scripts never enters the context window; only the output does.

#### Multi-Agent Orchestration Patterns

When a single agent's context becomes unmanageable, architectures shift to multi-agent patterns:

* **Subagents (Manager Pattern):** A centralized supervisor agent coordinates stateless subagents by calling them as tools. It provides strong context isolation and parallel execution, though it adds latency.
* **Handoffs (Decentralized Pattern):** Agents dynamically transfer control (and conversation state) to other specialized agents via tool calling, enabling sequential workflows.
* **Router Pattern:** A stateless router classifies user input, dispatches it to specialized agents in parallel, and synthesizes the results.

#### Skill Acquisition and Evolution

* **Reinforcement Learning (SAGE):** Agents use a Skill-integrated Reward and Sequential Rollout to learn and refine skills across tasks.
* **Autonomous Discovery (SEAgent):** Agents build a "world state model" to autonomously write software guidebooks and discover skills for unseen software.
* **Compositional Synthesis:** Agents dynamically select and combine modular skills from a library to solve complex reasoning tasks.

#### Security, Governance, and Boundaries

* **Skill Trust and Lifecycle Governance Framework:** A proposed four-tier security model mapping skill provenance to deployment capabilities. It uses verification gates: Static analysis (G1), semantic classification for intent mismatch (G2), behavioral sandboxing (G3), and permission manifest validation (G4).
* **Vulnerability Risks:** 26.1% of community skills contain vulnerabilities (prompt injection, credential exfiltration). Bundling executable scripts increases vulnerability risk by 2.12x.
* **Three-Tier Boundaries:** Instructions should categorize constraints into "Always do" (required actions), "Ask first" (actions requiring human approval like database modifications), and "Never do" (strict prohibitions like committing secrets).
* **Idempotence & Deterministic Zones:** LLMs are non-deterministic. To achieve stable, idempotent results (same result regardless of retries), skills split architecture into a "Smart Zone" (LLM interpretation) and a "Deterministic Zone" (hardcoded scripts executing fragile logic).

---

## 3. Comprehensive Coding-Related Information

#### 3.1. Skill Directory Structure and SKILL.md Specification

An Agent Skill must be a directory matching the skill's name, containing a SKILL.md file, and optionally containing scripts/, references/, and assets/ subdirectories.

**YAML Frontmatter Constraints:**

* `name`: Required. 1-64 characters, lowercase alphanumeric and hyphens only. No consecutive hyphens.
* `description`: Required. 1-1024 characters. Explains what the skill does and when to use it.
* `allowed-tools`: Optional. Space-delimited list of pre-approved tools (e.g., Bash, Read).
* `disable-model-invocation` / `user-invocable`: Optional. Booleans controlling if the skill can be auto-triggered or must be manually called via slash command.

**Full SKILL.md Example (LangGraph Docs):**

```markdown
---
name: langgraph-docs
description: Use this skill for requests related to LangGraph in order to fetch relevant documentation to provide accurate, up-to-date guidance.
license: MIT
compatibility: Requires internet access for fetching documentation URLs
metadata:
  author: langchain
  version: "1.0"
allowed-tools: fetch_url
---
# langgraph-docs
## Overview
This skill explains how to access LangGraph Python documentation to help answer questions and guide implementation.
## Instructions
### 1. Fetch the documentation index
Use the fetch_url tool to read the following URL:
https://docs.langchain.com/llms.txt
This provides a structured list of all available documentation with descriptions.
### 2. Select relevant documentation
Based on the question, identify 2-4 most relevant documentation URLs from the index. Prioritize:
- Specific how-to guides for implementation questions
- Core concept pages for understanding questions
- Tutorials for end-to-end examples
- Reference docs for API details
...
```

#### 3.2. OpenAI Agents SDK (Python)

**Single Agent with Tools:**

```python
from agents import Agent, WebSearchTool, function_tool

@function_tool
def save_results(output):
    db.insert({"output": output, "timestamp": datetime.time()})
    return "File saved"

search_agent = Agent(
    name="Search agent",
    instructions="Help the user search the internet and save results if asked.",
    tools=[WebSearchTool(), save_results],
)
```

**Manager Pattern (Subagents):**

```python
from agents import Agent, Runner

manager_agent = Agent(
    name="manager_agent",
    instructions=("If asked for multiple translations, you call the relevant tools."),
    tools=[
        spanish_agent.as_tool(tool_name="translate_to_spanish", tool_description="Translate the user's message to Spanish"),
        french_agent.as_tool(tool_name="translate_to_french", tool_description="Translate the user's message to French"),
        italian_agent.as_tool(tool_name="translate_to_italian", tool_description="Translate the user's message to Italian"),
    ],
)
...
```

#### 3.3. Microsoft Semantic Kernel & Agent Framework

**Creating a Native Plugin (Python):**

```python
from typing import TypedDict, Annotated, Optional, List
from semantic_kernel import Kernel
from semantic_kernel.functions import kernel_function

class LightModel(TypedDict):
    id: int
    name: str
    is_on: Optional[bool]
    brightness: Optional[int]
    hex: Optional[str]

class LightsPlugin:
    lights: list[LightModel] = [{"id": 1, "name": "Table Lamp", "is_on": False, "brightness": 100, "hex": "FF0000"}]

    @kernel_function
    async def get_lights(self) -> List[LightModel]:
        """Gets a list of lights and their current state."""
        return self.lights

    @kernel_function
    async def change_state(self, id: Annotated[int, "The ID of the light"], new_state: LightModel) -> Optional[LightModel]:
        """Changes the state of the light."""
        for light in self.lights:
            if light["id"] == id:
                light["is_on"] = new_state.get("is_on", light["is_on"])
                return light
        return None
```

**Exposing Semantic Kernel as an MCP Server (Python):**

```python
import anyio
from mcp.server.stdio import stdio_server

server = kernel.as_mcp_server(server_name="sk")

async def handle_stdin(stdin: Any | None = None, stdout: Any | None = None) -> None:
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())
anyio.run(handle_stdin)
```

#### 3.7. Code Evaluation & Evals (Node.js & Bash)

Evals treat agent executions as end-to-end tests by capturing JSONL traces.
**Parsing Traces (Node.js):**

```javascript
function checkRanNpmInstall(events) {
    return events.some((e) =>
        (e.type === "item.started" || e.type === "item.completed") &&
        e.item?.type === "command_execution" &&
        typeof e.item?.command === "string" &&
        e.item.command.includes("npm install")
    );
}
```

#### 3.9. Executable Scripts Embedded in Skills

**Python AppleScript Wrapper for macOS Notes App:**

```python
#!/usr/bin/env python3
import argparse
import subprocess

title = args.title.replace('"', '\\"')
body = args.body.replace('"', '\\"')
script = f'''
tell application "Notes"
    if not (exists folder "{FOLDER}") then
        make new folder with properties {{name:"{FOLDER}"}}
    end if
    make new note at folder "{FOLDER}" with properties {{body:"<h1>{title}</h1><br>{body}"}}
    return "Created: {title}"
end tell
'''
result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
```

#### 3.10. Web and CLI Tool Commands

* **Vercel Skills CLI:** `npx skills add <owner/repo>` or `npx skills find <query>`
* **AutoGPT/Forge:** `./run setup`, `./run forge create my-agent`, `./run benchmark --category coding`
* **Skyll API Queries:** `curl "https://api.skyll.app/search?q=react+performance&limit=5"`
* **GitHub/Fumadocs Actions Configuration:**

    ```yaml
    - name: Publish to skills repo
      uses: cpina/github-action-push-to-another-repository@main
      with:
        source-directory: 'agents-docs/skills-collections/.generated/'
        destination-github-username: 'inkeep'
        destination-repository-name: 'skills'
    ```
