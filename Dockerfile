# Production image – expects a LOCAL build already done (next build).
# The deploy script runs `npm run build` natively before `docker build`.
FROM node:20-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone output (pre-built locally)
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

# Install packages that are dynamically imported (await import()) and
# therefore not traced by Next.js standalone output. Without these,
# file parsing (PDF, Word, Excel) in /api/ai/parse-file fails at runtime.
# jszip required for DOCX edit (lib/docx/docx-xml-editor, review-docx)
# IMPORTANT: Do NOT overwrite the standalone package.json – it lists "next"
# as a dependency. Use --no-save so npm adds to node_modules without
# removing the existing packages that standalone needs.
# @smithy/node-http-handler needed by lib/docx/review-docx.ts (dynamically imported)
RUN npm install --no-save --no-package-lock --no-audit --no-fund \
    mammoth@1 pdf-parse@1 xlsx@0 jszip@3 @smithy/node-http-handler 2>/dev/null

EXPOSE 3000
CMD ["node", "server.js"]
