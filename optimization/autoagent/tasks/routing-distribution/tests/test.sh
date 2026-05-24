#!/bin/bash
python3 /app/agent.py "When will my track go live on Spotify if I submit it today?" | python3 /app/tests/test.py
