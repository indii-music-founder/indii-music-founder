FROM python:3.12-slim
WORKDIR /task

# Create non-root user for security
RUN groupadd -g 1000 taskuser && \
    useradd -u 1000 -g 1000 -m -s /bin/bash taskuser && \
    chown -R taskuser:taskuser /task

USER taskuser