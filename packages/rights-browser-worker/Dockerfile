FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/rights-browser-worker/package.json packages/rights-browser-worker/
COPY packages/rights-session-broker/package.json packages/rights-session-broker/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/rights-browser-worker/src packages/rights-browser-worker/src
COPY packages/rights-browser-worker/tsconfig.json packages/rights-browser-worker/
RUN npm run build -w packages/shared && npm run build -w packages/rights-browser-worker
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates && rm -rf /var/lib/apt/lists/*
ENV CHROME_BIN=/usr/bin/chromium NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json node_modules/@indii/shared/package.json
COPY --from=build /app/packages/shared/dist node_modules/@indii/shared/dist
COPY --from=build /app/packages/rights-browser-worker/dist ./dist
COPY packages/rights-browser-worker/package.json ./package.json
RUN chmod 4755 /usr/lib/chromium/chrome-sandbox && chmod -R a+rX /app
USER node
CMD ["node", "dist/index.js"]
