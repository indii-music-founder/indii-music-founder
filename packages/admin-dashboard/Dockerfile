FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/admin-dashboard/package*.json ./packages/admin-dashboard/
RUN npm ci --workspace=packages/admin-dashboard
COPY packages/admin-dashboard ./packages/admin-dashboard
RUN npm run build --workspace=packages/admin-dashboard

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/admin-dashboard/dist ./dist
COPY --from=builder /app/packages/admin-dashboard/server.ts ./
COPY --from=builder /app/packages/admin-dashboard/package*.json ./
RUN npm ci --production
RUN npm install -g typescript tsx
EXPOSE 3333
CMD ["npx", "tsx", "server.ts"]
