#!/bin/bash
fail=0
for i in 1 2 3 4; do
  echo "Running shard $i/4..."
  if ! npm test -- --run --reporter=dot --pool=forks --testTimeout=30000 --bail=3 --shard=$i/4; then
    echo "❌ Shard $i failed!"
    fail=1
  else
    echo "✅ Shard $i passed."
  fi
done
exit $fail
