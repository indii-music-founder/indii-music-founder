# Phase 1: Emergency Hotfix - Test Plan

## Overview
This document provides comprehensive test scenarios to verify that Phase 1 fixes have resolved the agent system "dismantling" issues.

## Changes Made

### Fix 1.1: Removed Duplicate delegate_task from CoreTools
- **Problem**: Two implementations existed - one in CoreTools (broken) and one in BaseAgent (correct)
- **Solution**: Removed the CoreTools version that used synchronous `agentRegistry.get()`
- **Expected Result**: No more "agent not found" errors for lazy-loaded agents

### Fix 1.2: Implemented Context Cloning in AgentService
- **Problem**: Context objects passed by reference were mutated during delegation
- **Solution**: Deep clone context before passing to child agents
- **Expected Result**: Parent agents maintain their execution state when delegating

### Fix 1.3: Added Execution Locks to BaseAgent
- **Problem**: Multiple agents could execute concurrently for same user/project
- **Solution**: Lock per user/project/agent combination serializes execution
- **Expected Result**: No race conditions from parallel agent execution

---

## Pre-Test Setup

### 1. Start the Development Server
```bash
cd /home/user/indiiOS-Alpha-Electron
npm run dev
```

### 2. Open Browser Console
- Navigate to http://localhost:4242
- Open Developer Tools (F12)
- Go to Console tab to monitor agent execution logs

### 3. Enable Verbose Logging (Optional)
Look for these log messages:
- `[BaseAgent] {AgentName} waiting for existing execution to complete...` - Execution lock working
- `[AgentService] Context cloned for delegation` - Context isolation working

---

## Test Scenarios

### Test 1: Basic Agent Delegation (Fix 1.1 Validation)

**Objective**: Verify that delegating to a specialist agent works without "agent not found" errors

**Steps**:
1. Open the Agent Chat interface
2. Send a message that requires delegation, e.g.:
   ```
   "Can you help me analyze a marketing campaign strategy and create a legal contract for it?"
   ```
3. This should trigger Agent Zero → Marketing Agent → Legal Agent delegation chain

**Expected Results**:
- ✅ No "agent not found" errors in console
- ✅ Agent Zero successfully delegates to Marketing Agent
- ✅ Marketing Agent successfully delegates to Legal Agent (or vice versa)
- ✅ All agents respond with their analysis
- ✅ Console shows proper agent loading: `[AgentRegistry] Loading agent: marketing`

**Failure Indicators**:
- ❌ Error: "Agent 'X' not found"
- ❌ Delegation fails silently
- ❌ Only Agent Zero responds, specialists never execute

---

### Test 2: Context Isolation (Fix 1.2 Validation)

**Objective**: Verify that parent agents maintain their execution state when delegating

**Steps**:
1. Open the Agent Chat
2. Send a complex request that requires multiple delegations:
   ```
   "I need you to:
   1. Create a marketing campaign for my new album
   2. Analyze the budget implications
   3. Draft a distribution contract

   Keep track of my project ID and brand context throughout."
   ```

3. Monitor the console for context mutations

**Expected Results**:
- ✅ Agent Zero maintains its context after delegating to Marketing Agent
- ✅ Marketing Agent maintains its context after delegating to Finance Agent
- ✅ Legal Agent maintains context after contract analysis
- ✅ No context.traceId or context.projectId overwrites
- ✅ All agents correctly reference the same project

**Failure Indicators**:
- ❌ Error: "Cannot read property 'projectId' of undefined"
- ❌ Agents lose track of the project context mid-execution
- ❌ Responses reference wrong project or missing brand info
- ❌ Console shows context mutation warnings

**Debug Commands** (run in browser console):
```javascript
// Check current agent state
window.useStore.getState().agentHistory.slice(-5)

// Verify context preservation
window.useStore.getState().currentProjectId
```

---

### Test 3: Execution Lock (Fix 1.3 Validation)

**Objective**: Verify that concurrent agent execution is properly serialized

**Steps**:
1. Open the Agent Chat
2. Rapidly send TWO messages back-to-back (within 1 second):

   **Message 1**: `"Generate a press release for my new single"`

   **Message 2**: `"Create a social media post about my tour"`

3. Both requests should trigger agent execution for the same user/project

**Expected Results**:
- ✅ Console shows: `[BaseAgent] {AgentName} waiting for existing execution to complete...`
- ✅ Second message waits for first message to complete
- ✅ Both requests complete successfully without conflicts
- ✅ No state corruption or mixed responses
- ✅ Responses are coherent and independent

**Failure Indicators**:
- ❌ Both messages execute simultaneously
- ❌ Responses are mixed or corrupted
- ❌ One message's response contains data from the other
- ❌ Error: "Race condition detected" or similar

---

### Test 4: Nested Delegation Chain (Combined Validation)

**Objective**: Verify all fixes work together in a complex delegation scenario

**Steps**:
1. Send a request that triggers deep delegation:
   ```
   "I want to launch a tour. Can you:
   1. Use the marketing agent to create a campaign
   2. Use the finance agent to calculate the budget
   3. Use the road agent to plan the route
   4. Use the legal agent to review venue contracts

   Coordinate all of this and give me a comprehensive plan."
   ```

2. This should trigger: Agent Zero → Marketing → Finance → Road → Legal

**Expected Results**:
- ✅ All 4+ agents execute successfully
- ✅ Each agent receives correct context
- ✅ No "agent not found" errors
- ✅ Execution is serialized (not all at once)
- ✅ Agent Zero successfully aggregates all responses
- ✅ Final response is coherent and comprehensive

**Failure Indicators**:
- ❌ Delegation chain breaks at any point
- ❌ Agents lose context mid-chain
- ❌ Race conditions cause incomplete responses
- ❌ Final response is missing information from some agents

---

### Test 5: Parallel Consultation (consult_experts)

**Objective**: Verify that parallel agent execution via consult_experts works correctly

**Steps**:
1. Send a message that benefits from multiple perspectives:
   ```
   "I'm planning a major album release. Consult with marketing, finance, and legal agents to give me a comprehensive strategy."
   ```

2. This should trigger `consult_experts` tool with 3 agents in parallel

**Expected Results**:
- ✅ All 3 agents execute (may be serialized due to execution locks)
- ✅ Each agent receives isolated context
- ✅ No context leakage between parallel executions
- ✅ All responses are collected and returned
- ✅ Agent Zero synthesizes insights from all 3

**Failure Indicators**:
- ❌ Only some agents respond
- ❌ Agents overwrite each other's work
- ❌ Context confusion between parallel executions
- ❌ Incomplete response synthesis

---

### Test 6: Stress Test - Multiple Users (If Multi-Tenancy Available)

**Objective**: Verify execution locks work across different users

**Steps**:
1. If you have access to multiple user accounts, open two browser windows
2. Log in as different users in each window
3. Send agent requests simultaneously from both windows

**Expected Results**:
- ✅ Each user's agents execute independently
- ✅ No cross-user context leakage
- ✅ Execution locks are scoped per user/project/agent
- ✅ Both users get correct responses

**Failure Indicators**:
- ❌ User A sees User B's data
- ❌ Cross-user race conditions
- ❌ Execution locks block all users (too coarse-grained)

---

## Monitoring & Debugging

### Key Console Messages to Watch For

**Good Signs (Fixes Working)**:
```
✅ [AgentRegistry] Loading agent: {agentId}
✅ [AgentService] Context cloned for delegation
✅ [BaseAgent] {AgentName} waiting for existing execution to complete...
✅ [AgentExecutor] Executing agent: {agentId} with traceId: {id}
```

**Bad Signs (Issues Remain)**:
```
❌ Agent '{agentId}' not found
❌ Error: Cannot read property 'X' of undefined
❌ Warning: Context mutation detected
❌ Error: Race condition detected
❌ Loop detected in {agentId}
```

### Browser Console Debugging Commands

```javascript
// Check agent execution state
window.useStore.getState().agentHistory

// Verify no active locks (should be empty when idle)
// Note: This is internal state, not directly accessible, but you can infer from logs

// Check current context
window.useStore.getState().activeOrg
window.useStore.getState().currentProjectId

// View agent messages
window.useStore.getState().agentHistory.slice(-10).forEach(msg => {
  console.log(`${msg.role}: ${msg.text.substring(0, 100)}`)
})
```

---

## Success Criteria

Phase 1 is considered successful if:

1. **✅ Zero "agent not found" errors** across all test scenarios
2. **✅ Context isolation verified** - No context mutation between parent/child agents
3. **✅ Execution serialization working** - Lock messages appear in console for concurrent requests
4. **✅ Complex delegation chains complete** - Multi-level delegation works end-to-end
5. **✅ No "dismantling" behavior** - Agents don't lose state mid-execution
6. **✅ Parallel consultation works** - consult_experts executes all agents successfully

---

## Reporting Issues

If any test fails, please provide:

1. **Test scenario name** (e.g., "Test 2: Context Isolation")
2. **Steps to reproduce**
3. **Console error messages** (copy full stack trace)
4. **Expected vs Actual behavior**
5. **Browser console logs** from the time of failure

You can export console logs:
- Right-click in Console → "Save as..."
- Or copy the full error with stack trace

---

## Next Steps After Testing

### If All Tests Pass ✅
- Ready to proceed to **Phase 2: Stability Fixes**
- Phase 2 includes:
  - Cross-agent loop detection
  - Enhanced observability
  - Better error handling

### If Some Tests Fail ❌
- Document failures and share console logs
- We may need additional hotfixes before Phase 2
- Prioritize critical failures (delegation chains breaking)

---

## Manual Testing Tips

1. **Test in Private/Incognito mode** - Clean state, no cached bugs
2. **Monitor Network tab** - Verify API calls are made correctly
3. **Check multiple projects** - Ensure fixes work across different contexts
4. **Test edge cases** - Invalid agent IDs, missing context, etc.
5. **Simulate real workflows** - Test actual use cases (album release, tour planning)

---

## Automated Testing (Future)

For future validation, we should add:
- Unit tests for context cloning
- Integration tests for delegation chains
- Stress tests for execution locks
- E2E tests for agent workflows

---

**Document Version**: Phase 1.0
**Last Updated**: 2026-01-19
**Related Commit**: a36e810
