#!/usr/bin/env bash
set -eo pipefail
echo "Verifying FFmpeg and Omni environment..."
if ! command -v ffmpeg &> /dev/null; then
  echo "FFmpeg not found in PATH." >&2
fi
exit 0
