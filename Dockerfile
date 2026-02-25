# Production image – expects a LOCAL build already done (next build).
# The deploy script runs `npm run build` natively before `docker build`.
FROM node:20-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Europe/Stockholm
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install Chromium + fonts for server-side PDF rendering via Puppeteer.
# fonts-liberation and fonts-noto provide professional typography.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-core \
    fonts-noto-cjk \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgbm1 \
    libnss3 \
    && ln -snf /usr/share/zoneinfo/Europe/Stockholm /etc/localtime \
    && echo "Europe/Stockholm" > /etc/timezone \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy standalone output (pre-built locally).
COPY next-standalone ./
COPY next-static ./.next/static
COPY public ./public

# Install packages that are dynamically imported (await import()) and
# therefore not traced by Next.js standalone output.
# puppeteer-core: headless Chromium PDF rendering (uses system chromium)
RUN npm install --no-save --no-package-lock --no-audit --no-fund \
    mammoth@1 pdf-parse@1 xlsx@0 jszip@3 @smithy/node-http-handler \
    @aws-sdk/client-textract \
    @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb \
    @aws-sdk/client-cognito-identity-provider \
    @aws-sdk/client-bedrock-runtime \
    @aws-sdk/client-s3 \
    @aws-sdk/client-secrets-manager \
    pdfkit puppeteer-core || true

EXPOSE 3000
CMD ["node", "server.js"]
