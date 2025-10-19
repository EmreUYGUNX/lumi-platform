# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=20.18.1
ARG PNPM_VERSION=8.15.8

FROM node:${NODE_VERSION}-alpine AS base

ARG PNPM_VERSION

RUN apk add --no-cache \
  bash \
  curl \
  git \
  libc6-compat \
  openssl \
  tini \
  python3 \
  py3-setuptools \
  build-base \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PNPM_STORE_PATH=/workspace/.pnpm-store
ENV PATH=${PNPM_HOME}:${PATH}
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
ENV PUPPETEER_SKIP_DOWNLOAD=true \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /workspace
RUN mkdir -p ${PNPM_HOME} ${PNPM_STORE_PATH}
RUN addgroup -S nodejs && adduser -S lumi -G nodejs -u 1001

FROM base AS deps

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/
COPY packages/shared/package.json packages/shared/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY patches ./patches/
RUN pnpm fetch --filter @lumi/backend...

FROM base AS development

ENV NODE_ENV=development
WORKDIR /workspace
COPY --from=deps /workspace/.pnpm-store /workspace/.pnpm-store
COPY . .
RUN pnpm install --filter @lumi/backend... --frozen-lockfile
EXPOSE 4000
ENV PNPM_YES=true \
  PNPM_NON_INTERACTIVE=true
CMD ["sh", "-c", "pnpm install --filter @lumi/backend... --frozen-lockfile && pnpm --filter @lumi/backend dev"]

FROM base AS build

ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=deps /workspace/.pnpm-store /workspace/.pnpm-store
COPY . .
RUN NODE_ENV=development pnpm install --filter @lumi/backend... --frozen-lockfile
RUN NODE_ENV=production pnpm --filter @lumi/backend... build
RUN pnpm prune --prod

FROM node:${NODE_VERSION}-alpine AS production

ARG BUILD_DATE=unknown
ARG VCS_REF=dev
LABEL org.opencontainers.image.title="Lumi Backend Service" \
  org.opencontainers.image.description="Enterprise backend service for the Lumi commerce platform." \
  org.opencontainers.image.source="https://github.com/lumi-commerce/lumi-ticaret" \
  org.opencontainers.image.revision="${VCS_REF}" \
  org.opencontainers.image.created="${BUILD_DATE}" \
  org.opencontainers.image.security.scan-status="required"

RUN apk add --no-cache tini ca-certificates openssl
RUN addgroup -S nodejs && adduser -S lumi -G nodejs -u 1001

ENV NODE_ENV=production \
  PORT=4000
WORKDIR /app
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/backend/dist ./apps/backend/dist
COPY --from=build /workspace/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /workspace/packages ./packages
COPY --from=build /workspace/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN chown -R lumi:nodejs /app
USER lumi
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "const net=require('net');const port=parseInt(process.env.PORT||'4000',10);const socket=net.connect({port,host:'127.0.0.1'},()=>{socket.end();process.exit(0);});socket.on('error',()=>process.exit(1));"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/backend/dist/index.js"]
