FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/rights-browser-worker/package.json packages/rights-browser-worker/
COPY packages/rights-session-broker/package.json packages/rights-session-broker/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/rights-session-broker/src packages/rights-session-broker/src
COPY packages/rights-session-broker/tsconfig.json packages/rights-session-broker/
RUN npm run build -w packages/shared && npm run build -w packages/rights-session-broker
FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json node_modules/@indii/shared/package.json
COPY --from=build /app/packages/shared/dist node_modules/@indii/shared/dist
COPY --from=build /app/packages/rights-session-broker/dist ./dist
COPY packages/rights-session-broker/package.json ./package.json
RUN chmod -R a+rX /app
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
