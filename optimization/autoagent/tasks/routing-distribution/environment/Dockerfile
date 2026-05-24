FROM python:3.11-slim

WORKDIR /app

# Copy the agent wrapper and tasks test files
COPY agent.py /app/agent.py
COPY tasks/routing-distribution/tests/test.py /app/tests/test.py

# Create a placeholder logs directory for reward.txt output
RUN mkdir -p /logs

CMD ["python3", "/app/agent.py"]
