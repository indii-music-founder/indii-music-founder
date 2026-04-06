#!/bin/bash
set -e
echo "Indii Custom Initialization..."
# The original script skips copy if run_ui.py exists.
# We want the files AND our custom run_ui.py.
# So we copy manually first.
echo "Manually copying files from /git/agent-zero to /a0..."
cp -rn /git/agent-zero/. /a0/ || true
echo "Overriding /a0/run_ui.py with patched version..."
cp /a0_indii/run_ui.py /a0/run_ui.py
echo "Overriding /a0/python/helpers/mcp_server.py with patched version..."
cp /a0_indii/mcp_server.py /a0/python/helpers/mcp_server.py
echo "Handing over to original initialize.sh..."
exec /exe/initialize.sh master
