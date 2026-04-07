# Minimal task environment for routing tasks. Just needs python3 + bash so the
# verifier can run. No internet (`allow_internet = false` in task.toml).
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash coreutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /task
