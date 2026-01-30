#!/bin/bash
# scripts/run_agent_zero_manual.sh

# Load env variables
if [ -f .env ]; then
  source .env
fi

# Ensure settings.json exists to prevent directory creation
if [ ! -f settings.json ]; then
  echo "{}" > settings.json
fi

# Cleanup existing container
echo "Stopping existing indii-agent..."
docker rm -f indii-agent || true

# Run container
echo "Starting indii-agent..."
docker run -d \
  --name indii-agent \
  --restart unless-stopped \
  -p 50080:80 \
  -p 8880:8080 \
  -v "$HOME/Documents/indii_Workspace:/a0/usr/projects" \
  -v "$(pwd)/python/tools:/a0/python/tools/custom" \
  -v "$(pwd)/prompts:/a0/prompts/custom" \
  -v "$(pwd)/agents:/a0/agents/custom" \
  -v "$(pwd)/python/tools/indii_image_gen.py:/a0/python/tools/indii_image_gen.py" \
  -v "$(pwd)/python/tools/indii_video_gen.py:/a0/python/tools/indii_video_gen.py" \
  -v "$(pwd)/python/tools/indii_audio_ear.py:/a0/python/tools/indii_audio_ear.py" \
  -v "$(pwd)/python/config/ai_models.py:/a0/python/config/ai_models.py" \
  -v "$(pwd)/prompts/agent.system.tool.indii_image_gen.md:/a0/prompts/agent.system.tool.indii_image_gen.md" \
  -v "$(pwd)/prompts/agent.system.tool.indii_video_gen.md:/a0/prompts/agent.system.tool.indii_video_gen.md" \
  -v "$(pwd)/prompts/agent.system.tool.indii_audio_ear.md:/a0/prompts/agent.system.tool.indii_audio_ear.md" \
  -v "$(pwd)/agents/indii_curriculum:/a0/agents/indii_curriculum" \
  -v "$(pwd)/python/api/provision_project.py:/a0/python/api/provision_project.py" \
  -v "$(pwd)/python/api/indii_sync.py:/a0/python/api/indii_sync.py" \
  -v "$(pwd)/prompts/templates:/a0/prompts/templates" \
  -v "$(pwd)/global_assets/knowledge:/a0/knowledge" \
  -v "$(pwd)/agents/indii_executor:/a0/agents/indii_executor" \
  -v "$(pwd)/agents/default:/a0/agents/default" \
  -v "$(pwd)/agents/agent0:/a0/agents/agent0" \
  -v "$(pwd)/agents/providers.yaml:/a0/agents/providers.yaml" \
  -v "$(pwd)/python/api/indii_task.py:/a0/python/api/indii_task.py" \
  -v "$(pwd)/python/api/auth_broker.py:/a0/python/api/auth_broker.py" \
  -v "$(pwd)/python/api/healthz.py:/a0/python/api/healthz.py" \
  -v "$(pwd)/settings.json:/a0/tmp/settings.json" \
  -e PORT=80 \
  -e WEB_UI_HOST=127.0.0.1 \
  -e GOOGLE_API_KEY="$GOOGLE_API_KEY" \
  -e GEMINI_API_KEY="$GOOGLE_API_KEY" \
  -e EMBEDDING_MODEL="models/embedding-001" \
  agent0ai/agent-zero:latest \
  tail -f /dev/null

echo "Container started. ID: $(docker ps -q -f name=indii-agent)"
