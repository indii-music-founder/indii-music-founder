# Agent Zero Sidecar - Quick Start Guide

## Overview

The Agent Zero Sidecar is a Docker-based AI agent that runs alongside the indiiOS Electron application, providing advanced capabilities like image generation, video synthesis, and audio analysis through a secure, isolated environment.

---

## Prerequisites

- Docker Desktop installed and running
- Docker Compose v2.0+
- Port 50080 available (Agent Zero API)
- Port 8880 available (Tunnel API)

---

## Quick Start

### 1. Start the Agent Zero Container

```bash
cd /path/to/indiiOS-Alpha-Electron
docker compose up -d
```

### 2. Verify Health

```bash
curl http://localhost:50080/healthz
```

Expected response:

```json
{
  "status": "healthy",
  "service": "indii-agent",
  "version": "0.1.0"
}
```

### 3. Test Basic Functionality

```bash
python3 scripts/verify_bridge.py
```

---

## API Endpoints

### Health Check

```bash
GET http://localhost:50080/healthz
```

### Task Execution

```bash
POST http://localhost:50080/indii_task
Content-Type: application/json

{
  "instruction": "Generate an image of a sunset"
}
```

### Auth Broker (Secrets Management)

```bash
POST http://localhost:50080/auth_broker
Content-Type: application/json

{
  "action": "generate_handle",
  "secret_id": "google_api"
}
```

---

## Available Tools

### 1. Image Generation (`indii_image_gen`)

Generates images using Gemini Imagen 3.

**Usage:**

```
Generate an image of a cyberpunk city at night
```

**Output:**

- Image saved to `/a0/usr/projects/{project_id}/assets/image/gen_{timestamp}.png`
- Returns `img://` protocol path for UI rendering

### 2. Video Generation (`indii_video_gen`)

Generates videos using Google Veo 3.1.

**Usage:**

```
Create a 5-second video of waves crashing on a beach
```

**Output:**

- Video saved to `/a0/usr/projects/{project_id}/assets/video/gen_{timestamp}.mp4`

### 3. Audio Analysis (`indii_audio_ear`)

Analyzes audio files using Gemini multimodal capabilities.

**Usage:**

```
Analyze the audio file at /path/to/audio.mp3
```

---

## Configuration

### Environment Variables

Set these in your `.env` file or Docker environment:

```bash
# Required
GOOGLE_API_KEY=your_google_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here  # Optional, falls back to GOOGLE_API_KEY

# Optional
EMBEDDING_MODEL=models/embedding-001
WEB_UI_HOST=0.0.0.0
WEB_UI_PORT=80
```

### Custom Agent Profiles

Agent profiles are located in `agents/` directory:

- `agents/indii_executor/` - Task execution agent
- `agents/indii_curriculum/` - Learning and training agent
- `agents/custom/` - Custom agent configurations

---

## Troubleshooting

### Container Won't Start

```bash
# Check Docker daemon
docker ps

# View logs
docker logs indii-agent-working

# Rebuild container
docker compose down
docker compose build
docker compose up -d
```

### Connection Refused

```bash
# Verify port mapping
docker ps | grep indii-agent-working

# Check if port 50080 is available
lsof -i :50080

# Restart container
docker compose restart
```

### API Key Errors

```bash
# Verify environment variables are set
docker exec indii-agent-working env | grep API_KEY

# Check auth broker
curl -X POST http://localhost:50080/auth_broker \
  -H "Content-Type: application/json" \
  -d '{"action": "list_handles"}'
```

---

## Testing

### Run All Verification Tests

```bash
# Phase 1-2: Infrastructure
python3 scripts/test_volume_mapping.py
python3 scripts/test_network_isolation.py

# Phase 3: API Handlers
python3 scripts/verify_bridge.py
python3 scripts/test_context_bleed.py

# Phase 4: Tooling
python3 scripts/test_protocol.py
python3 scripts/test_zeroization.py

# Phase 5: Security
python3 scripts/test_honeypot.py
```

### Manual Testing

```bash
# Test image generation
curl -X POST http://localhost:50080/indii_task \
  -H "Content-Type: application/json" \
  -d '{"instruction": "Generate an image of a mountain landscape"}'

# Test auth broker
curl -X POST http://localhost:50080/auth_broker \
  -H "Content-Type: application/json" \
  -d '{"action": "generate_handle", "secret_id": "google_api"}'
```

---

## Integration with Electron App

### 1. Enable Agent Zero in UI

In the Chat Overlay, toggle the provider from "Native" to "Zero":

```typescript
// The AgentService automatically routes to Agent Zero
await AgentService.sendMessage(message, conversationId);
```

### 2. Monitor Tool Execution

Tool execution progress is logged in the Docker container:

```bash
docker logs -f indii-agent-working
```

### 3. Handle Responses

Agent Zero responses include:

- `agent_response`: The text response from the agent
- `tool_results`: Results from tool executions (images, videos, etc.)

---

## Security Best Practices

### 1. Secrets Management

- Never hardcode API keys
- Use the Auth Broker for opaque handle generation
- Zeroize handles after task completion

### 2. Network Isolation

- Container runs on isolated Docker network
- Only expose necessary ports (50080, 8880)
- Use firewall rules to restrict access

### 3. Prompt Injection Protection

- Agent includes built-in prompt injection detection
- System prompts are protected from override attempts
- File system access is restricted to project directories

---

## Performance Optimization

### 1. Image Generation

- Average time: ~250 seconds
- Use caching for repeated prompts
- Consider batch processing for multiple images

### 2. Container Resources

- Recommended: 4GB RAM minimum
- CPU: 2+ cores for parallel processing
- Storage: 10GB+ for generated assets

### 3. Monitoring

```bash
# Check container resource usage
docker stats indii-agent-working

# Monitor logs in real-time
docker logs -f --tail 100 indii-agent-working
```

---

## Advanced Usage

### Custom Tool Development

1. Create tool in `python/tools/your_tool.py`
2. Mount via Docker volume in `docker-compose.yml`:

   ```yaml
   volumes:
     - ./python/tools/your_tool.py:/a0/python/tools/your_tool.py
   ```

3. Restart container to load new tool

### Multi-Instance Deployment

For production deployments with multiple instances:

1. Use Redis for handle registry (replace in-memory storage)
2. Configure load balancer for port 50080
3. Share `/a0/usr/projects/` via network storage (NFS/S3)

---

## Support & Documentation

- **Full Test Results:** `docs/AGENT_ZERO_TEST_RESULTS.md`
- **Architecture Guide:** `docs/HYBRID_ARCHITECTURE.md`
- **API Reference:** `docs/API_CREDENTIALS_POLICY.md`

---

**Last Updated:** 2026-01-30  
**Version:** 1.0.0
