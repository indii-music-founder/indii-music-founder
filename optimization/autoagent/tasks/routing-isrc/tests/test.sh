#!/bin/bash
python3 /app/agent.py "A user asks how they can register an ISRC code for their new single." | python3 /app/tests/test.py
