# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=20.12.2
ARG PNPM_VERSION=9.0.6

FROM node:${NODE_VERSION}-alpine AS base

ARG PNPM_VERSION

RUN apk add --no-cache bash curl libc6-compat openssl tini
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PNPM_STORE_PATH=/workspace/.pnpm-store
ENV PATH=${PNPM_HOME}:${PATH}
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /workspace
RUN mkdir -p ${PNPM_HOME} ${PNPM_STORE_PATH}
RUN addgroup -S nodejs && adduser -S lumi -G nodejs -u 1001

FROM base AS deps

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/frontend/package.json apps/frontend/
COPY packages/shared/package.json packages/shared/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm-store,target=/workspace/.pnpm-store \
  pnpm fetch --filter @lumi/frontend...

FROM base AS development

ENV NODE_ENV=development
WORKDIR /workspace
COPY --from=deps /workspace/.pnpm-store /workspace/.pnpm-store
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/workspace/.pnpm-store \
  pnpm install --filter @lumi/frontend... --frozen-lockfile
RUN chown -R lumi:nodejs /workspace
USER lumi
EXPOSE 3000
CMD ["pnpm", "--filter", "@lumi/frontend", "dev"]

FROM base AS build

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /workspace
COPY --from=deps /workspace/.pnpm-store /workspace/.pnpm-store
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/workspace/.pnpm-store \
  NODE_ENV=development pnpm install --filter @lumi/frontend... --frozen-lockfile
RUN NODE_ENV=production pnpm --filter @lumi/frontend... build
RUN pnpm prune --prod --filter @lumi/frontend...

FROM base AS production

ARG BUILD_DATE=unknown
ARG VCS_REF=dev
LABEL org.opencontainers.image.title="Lumi Frontend Application" \
  org.opencontainers.image.description="Next.js frontend for the Lumi commerce platform." \
  org.opencontainers.image.source="https://github.com/lumi-commerce/lumi-ticaret" \
  org.opencontainers.image.revision="${VCS_REF}" \
  org.opencontainers.image.created="${BUILD_DATE}" \
  org.opencontainers.image.security.scan-status="required"

ENV NODE_ENV=production \
  PORT=3000 \
  NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/frontend ./apps/frontend
RUN rm -rf ./apps/frontend/node_modules ./apps/frontend/src
COPY --from=build /workspace/packages ./packages
COPY --from=build /workspace/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN chown -R lumi:nodejs /app
USER lumi
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "const net=require('net');const port=parseInt(process.env.PORT||'3000',10);const socket=net.connect({port,host:'127.0.0.1'},()=>{socket.end();process.exit(0);});socket.on('error',()=>process.exit(1));"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "--filter", "@lumi/frontend", "start"]
