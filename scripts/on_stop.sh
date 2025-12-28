#!/bin/bash

echo "🛑 Gatekeeper Active: Verifying completion..."

# 1. RUN THE VERIFICATION (The "Truth")
# This is the binary success criteria mentioned in Source 6.
# Replace 'npm test' with your specific build/verify command.
npm test > validation_log.txt 2>&1
TEST_EXIT_CODE=$?

# 2. CHECK FOR FAILURE
if [ $TEST_EXIT_CODE -ne 0 ]; then
    echo "❌ GATEKEEPER BLOCK: Tests failed."
    echo "You claimed to be done, but the verification failed."
    echo "Here are the errors you need to fix in the next loop:"
    echo "---------------------------------------------------"
    # Output the tail of the log so the AI sees why it failed
    tail -n 20 validation_log.txt
    echo "---------------------------------------------------"
    
    # EXIT 1 is critical. This tells the loop "DO NOT EXIT".
    exit 1
fi

# 3. CHECK FOR THE "SAFE WORD" (Source 2)
# We grep the last few lines of the agent's output (passed via stdin or log)
# Note: For many agents, the test passing is enough, but this enforces the protocol.
echo "✅ Tests passed. Verifying Completion Promise..."

# If we arrive here, the AI is allowed to leave.
echo "🚀 Success. Exiting Loop."
exit 0
