---
description: Communicate directly with INDEX (OpenClaw) by sending a message through its local chat interface using the browser subagent, optionally giving it vision of your desktop.
---
# /talk

This workflow delegates a communication task to the browser subagent, allowing Antigravity to autonomously drop a message into INDEX's chat interface (running at `http://localhost:18888`). It also supports an optional "vision" mode to capture your current screen and share it with INDEX.

## Execution Steps

1. **Verify MCP Connectivity**
   Before initiating communication, check your available tools to confirm that the OpenClaw MCP server is active (look for tools like `send_to_session`, `memory_query`, `spawn_subagent`, etc., or use `list_resources`).
   - If the tools are **missing**, inform wii immediately: *"My MCP connection to OpenClaw is currently inactive. Please 'Reload Window' or restart me so I can pick up the latest MCP configuration."*
   - Only proceed with the talk sequence once you have confirmed you possess the required MCP tools, as a broken bridge causes silent failures.

2. **Check for "Vision" Request**
   If wii appends `--vision` (e.g., `/talk --vision "Why is this crashing?"`), you must FIRST capture a screenshot of the desktop.
   - **Command:**

     ```bash
     screencapture -x "/Volumes/X SSD 2025/Users/narrowchannel/.openclaw/workspace/antigravity_vision.png"
     ```

   - **Message Modification:** Append to your message: *"I just dropped a fresh screenshot of my desktop in your workspace at `antigravity_vision.png`."*

3. **Format the Message**
   Ensure you have formulated the exact message you need to send to INDEX. By default, you can instruct INDEX to check the MCP shared memory, or you can send a specific question/update based on the user's prompt.
   - **Message Identity Rules:** You MUST always prepend your message with a prefix indicating you are the sender, to differentiate it from messages typed by the user directly. Format your prefix like this: `[From Antigravity]:` (e.g., `[From Antigravity]: All right, you restarted all your...`).

4. **Launch the Browser Subagent**
   Use the `browser_subagent` tool with the following parameters:
   - `TaskName`: 'Ping INDEX via OpenClaw Chat'
   - `TaskSummary`: 'Navigate to the OpenClaw local chat interface and convey a message to INDEX.'
   - `RecordingName`: 'ping_index_chat'
   - `Task`: 'First, use your browser management tools to check if a page for OpenClaw (localhost:18888) is already open. If it is, switch to it instead of opening a new page. Otherwise, navigate to <http://localhost:18888>. Wait for the OpenClaw chat interface to load. Locate the main chat input box. Type the following message EXACTLY: "[Insert your message here]". Press Enter or click the Send button to submit the message into the chat. Verify the message appears in the chat stream, then return success.'

5. **Verify and Report**
   Once the subagent returns, confirm to the user (wii) that the communication bridge was successfully crossed and the message was delivered directly to INDEX's screen.
