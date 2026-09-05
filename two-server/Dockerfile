# Multi-Stage Production Dockerfile for Two Zero-Knowledge Relay Server
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY prisma ./prisma
COPY src ./src

RUN npx tsc

# Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
COPY --from=builder /app/dist ./dist

EXPOSE 4000

USER node

CMD ["node", "dist/server.js"]
