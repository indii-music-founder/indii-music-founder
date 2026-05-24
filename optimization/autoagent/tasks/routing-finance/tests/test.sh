#!/bin/bash
python3 /app/agent.py "How do splits work for co-writers and what is the payout threshold?" | python3 /app/tests/test.py
