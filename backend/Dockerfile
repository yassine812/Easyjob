# ---------- deps ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
# The backend lockfile may be generated on Windows and contains optional
# platform entries that npm 24 rejects in Alpine. Resolve the exact package.json
# versions in the Linux build instead of failing the production image build.
RUN rm -f package-lock.json && npm install --no-audit --no-fund

# ---------- build ----------
FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate \
  && npm run build \
  # The seed imports src constants, so compile it into dist/prisma/prisma/seed.js
  && npx tsc prisma/seed.ts prisma/seed-system.ts --outDir dist/prisma --rootDir . --module commonjs --target ES2021 --moduleResolution node --esModuleInterop --skipLibCheck --resolveJsonModule

# Dependencies are installed without a lockfile above because the repository can
# be built on Windows and deployed on Linux. Keeping the dev packages in this
# image avoids a second npm reify pass (which can hang on cross-platform locks);
# the runtime command only loads the compiled Nest/Prisma output.

# ---------- run ----------
FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV RUN_WORKERS=false
ENV NODE_USE_SYSTEM_CA=1
# Prisma's query engine needs OpenSSL at runtime.
RUN apk add --no-cache openssl poppler-utils unzip antiword
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts/bootstrap-admin.cjs ./scripts/bootstrap-admin.cjs
COPY --from=build /app/scripts/create-platform-admin.cjs ./scripts/create-platform-admin.cjs
COPY --from=build /app/scripts/sync-company-careers.cjs ./scripts/sync-company-careers.cjs
COPY --from=build /app/scripts/sync-tanitjobs.cjs ./scripts/sync-tanitjobs.cjs
COPY --from=build /app/scripts/job-sources-health.cjs ./scripts/job-sources-health.cjs
RUN mkdir -p /app/storage /app/.runtime && chown -R node:node /app/storage /app/prisma /app/.runtime
USER node
EXPOSE 3000
# Runs migrations (needs prisma CLI — kept via prisma in dependencies in production image)
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main.js"]
