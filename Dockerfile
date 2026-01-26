# Build image
FROM node:20-bullseye AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build Next.js app
RUN npm run build

# Production image
FROM node:20-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only what is needed to run (standalone output)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]

