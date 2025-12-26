#!/bin/bash
mkdir -p test-results/stress

echo "Starting stress test (10 runs)... Log files in test-results/stress/"

for i in {1..10}
do
   echo "----------------------------------------"
   echo "Run #$i"
   echo "----------------------------------------"
   
      npx vitest run \
        src/modules/command/CommandBar.test.tsx \
        src/services/agent/AgentOrchestrator.test.ts \
        src/services/agent/specialists.test.ts \
        src/services/rag/GeminiRetrievalService.test.ts \
        src/services/storage/repository.test.ts \
        --reporter=verbose > "test-results/stress/run_$i.log" 2>&1
   
   if [ $? -ne 0 ]; then
     echo "❌ Failed on run #$i - Check test-results/stress/run-$i.log"
     # Don't exit immediately, let's see how many fail
     # exit 1
   else 
     echo "✅ Run #$i Passed"
   fi
done

echo "Stress test complete."

