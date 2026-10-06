# Use Node.js 24 Alpine as base image for smaller size, explicitly target amd64/linux
FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies based on the preferred package manager
# (package-lock.json is copied when it exists in the build context)
COPY package*.json ./

# Configure npm for private packages
# These build args should be passed during build time
ARG NPM_REGISTRY=https://registry.npmjs.org/

# Set up npm configuration for private packages
RUN --mount=type=secret,id=NPM_TOKEN,env=NPM_TOKEN \
  if [ -n "$NPM_TOKEN" ]; then \
      echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && \
      echo "registry=${NPM_REGISTRY}" >> .npmrc; \
    fi

# use a reproducible install when a lockfile is available. Note: the workspace
# lockfile lives at the repo root, so with packages/server as the build context
# this falls back to npm install.
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      echo "WARNING: no package-lock.json in build context, falling back to npm install" && \
      npm install; \
    fi

# Clean up npmrc to avoid exposing token in final image
RUN rm -f .npmrc

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application (also generates the Prisma client into src/generated,
# which the build copies into dist/generated)
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 userjs

# Copy the built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/static ./static

# Change ownership of the app directory to the nodejs user
RUN chown -R userjs:nodejs /app

USER userjs

EXPOSE 3000

ENV SERVER_PORT=3000

CMD ["npm", "start"]