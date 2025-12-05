#!/bin/bash
echo "Starting stress test (10 runs)..."

for i in {1..10}
do
   echo "----------------------------------------"
   echo "Run #$i"
   echo "----------------------------------------"
   
   npx vitest run src/core/components/CommandBar.test.tsx src/services/agent/components/AgentOrchestrator.test.ts src/services/agent/specialists/specialists.test.ts
   
   if [ $? -ne 0 ]; then
     echo "❌ Failed on run #$i"
     exit 1
   fi
done

echo "✅ All 10 runs passed successfully."
