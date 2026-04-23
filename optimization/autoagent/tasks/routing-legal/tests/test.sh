#!/usr/bin/env bash
# Harbor verifier entrypoint. Runs the test, computes the reward, writes
# /logs/verifier/reward.txt as a single integer (1 = pass, 0 = fail).
set -uo pipefail
mkdir -p /logs/verifier
python3 /task/tests/test.py
exit_code=$?
if [ "$exit_code" -eq 0 ]; then
  echo -n "1" > /logs/verifier/reward.txt
else
  echo -n "0" > /logs/verifier/reward.txt
fi
exit 0
