# syntax=docker/dockerfile:1
# FormGL API — build from the monorepo root:
#   docker build -f apps/api/Dockerfile -t formgl-api .
#   docker run --env-file .env -p 4000:4000 formgl-api
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter "@formgl/api..."
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @formgl/shared build && pnpm --filter @formgl/api build
# self-contained production bundle: dist/, drizzle/ migrations, prod node_modules (incl. @formgl/shared)
RUN pnpm --filter @formgl/api deploy --prod --legacy /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production API_PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- "http://127.0.0.1:${API_PORT}/api/health" >/dev/null || exit 1
CMD ["node", "dist/main.js"]
