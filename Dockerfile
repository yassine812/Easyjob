# ---------- deps ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---------- build ----------
FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate \
  && npm run build \
  # The seed imports src constants, so compile it into dist/prisma/prisma/seed.js
  && npx tsc prisma/seed.ts prisma/seed-system.ts --outDir dist/prisma --rootDir . --module commonjs --target ES2021 --moduleResolution node --esModuleInterop --skipLibCheck --resolveJsonModule \
  && npm prune --omit=dev

# ---------- run ----------
FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV RUN_WORKERS=false
# Prisma's query engine needs OpenSSL at runtime.
RUN apk add --no-cache openssl
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts/bootstrap-admin.cjs ./scripts/bootstrap-admin.cjs
RUN mkdir -p /app/storage && chown -R node:node /app/storage /app/prisma
USER node
EXPOSE 3000
# Runs migrations (needs prisma CLI — kept via prisma in dependencies in production image)
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main.js"]
