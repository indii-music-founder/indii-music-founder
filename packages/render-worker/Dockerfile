# indii cloud render worker — Node + Chromium + ffmpeg for server-side
# HyperFrames composition rendering (MIG-010).
#
# Build:  docker build -f packages/render-worker/Dockerfile -t indii-render-worker .
# Run locally:
#   docker run -p 8080:8080 -e RENDER_WORKER_SECRET=... \
#     -e GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/gcp \
#     -v /path/to/creds.json:/run/secrets/gcp:ro indii-render-worker
# On Cloud Run, drop GOOGLE_APPLICATION_CREDENTIALS (workload identity) and
# set HYPERFRAMES_BROWSER_PATH=/usr/bin/chromium (already the image default).

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/video-compiler/package.json packages/video-compiler/
COPY packages/render-worker/package.json packages/render-worker/
COPY packages/shared/src packages/shared/src
COPY packages/video-compiler/src packages/video-compiler/src
COPY packages/render-worker/src packages/render-worker/src
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/video-compiler/tsconfig.json packages/video-compiler/
COPY packages/render-worker/tsconfig.json packages/render-worker/
RUN npm install --ignore-scripts --no-audit --no-fund && \
    npm run build --workspace=@indii/shared && \
    npm run build --workspace=@indii/video-compiler && \
    npm run build --workspace=@indii/render-worker

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium ffmpeg fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
ENV CHROME_BIN=/usr/bin/chromium \
    HYPERFRAMES_BROWSER_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/video-compiler/dist packages/video-compiler/dist
COPY --from=build /app/packages/video-compiler/package.json packages/video-compiler/package.json
COPY --from=build /app/packages/render-worker/dist packages/render-worker/dist
COPY --from=build /app/packages/render-worker/package.json packages/render-worker/package.json
# npm workspace links do not survive the build-stage boundary reliably.
# Replace them with physical runtime packages so Node resolves package metadata.
RUN rm -rf node_modules/@indii/shared node_modules/@indii/video-compiler
COPY --from=build /app/packages/shared/package.json node_modules/@indii/shared/package.json
COPY --from=build /app/packages/shared/dist node_modules/@indii/shared/dist
COPY --from=build /app/packages/video-compiler/package.json node_modules/@indii/video-compiler/package.json
COPY --from=build /app/packages/video-compiler/dist node_modules/@indii/video-compiler/dist
# Chromium sandbox: Cloud Run's hardened kernel requires the setuid helper.
RUN chmod 4755 /usr/lib/chromium/chrome-sandbox 2>/dev/null || true
USER node
EXPOSE 8080
CMD ["node", "packages/render-worker/dist/index.js"]
