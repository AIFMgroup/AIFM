# Build image
FROM node:20-bullseye AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Inject cache version into service worker for cache busting on deploy
ARG CACHE_VERSION=dev
RUN sed -i "s/__CACHE_VERSION__/${CACHE_VERSION}/g" public/sw.js

# Build the root Next.js app (the new design)
RUN npx next build

# Production image
FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone output from root app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
