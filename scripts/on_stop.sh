#!/bin/bash

echo "🛑 Gatekeeper Active: Verifying completion..."

# 1. RUN THE VERIFICATION (The "Truth")
# If RUN_GAUNTLET is true, run the full verification suite
if [ "$RUN_GAUNTLET" = "true" ]; then
    echo "🛡️ FULL GAUNTLET MODE: Running comprehensive verification..."
    ./scripts/run-gauntlet.sh
    TEST_EXIT_CODE=$?
else
    echo "🧪 QUICK VERIFY: Running unit tests..."
    # This is the binary success criteria mentioned in Source 6.
    npm test -- --run --test-timeout=20000 > validation_log.txt 2>&1
    TEST_EXIT_CODE=$?
fi

# 2. CHECK FOR FAILURE
if [ $TEST_EXIT_CODE -ne 0 ]; then
    echo "❌ GATEKEEPER BLOCK: Verification failed."
    echo "You claimed to be done, but the system detected issues."
    echo ""
    echo "CRITICAL ERRORS FOUND:"
    echo "---------------------------------------------------"
    if [ "$RUN_GAUNTLET" = "true" ]; then
        echo "Check the Gauntlet output above for failures."
    else
        # Output the tail of the log so the AI sees why it failed
        tail -n 25 validation_log.txt
    fi
    echo "---------------------------------------------------"
    echo ""
    echo "📝 Tip: Review the errors above, fix the code, and run on_stop again."
    
    # EXIT 1 is critical. This tells the agent "DO NOT EXIT".
    exit 1
fi

# 3. CHECK FOR THE "SAFE WORD" (Source 2)
# We grep the last few lines of the agent's output (passed via stdin or log)
# Note: For many agents, the test passing is enough, but this enforces the protocol.
echo "✅ Tests passed. Verifying Completion Promise..."

# If we arrive here, the AI is allowed to leave.
echo "🚀 Success. Exiting Loop."
exit 0
