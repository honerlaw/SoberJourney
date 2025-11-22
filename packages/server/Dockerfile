# Use Node.js 22 Alpine as base image for smaller size, explicitly target amd64/linux
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json ./

# Configure npm for private packages
# These build args should be passed during build time
ARG NPM_REGISTRY=https://registry.npmjs.org/

# Set up npm configuration for private packages
RUN --mount=type=secret,id=NPM_TOKEN,env=NPM_TOKEN \
  if [ -n "$NPM_TOKEN" ]; then \
      echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && \
      echo "registry=${NPM_REGISTRY}" >> .npmrc; \
    fi

RUN npm i

# Clean up npmrc to avoid exposing token in final image
RUN rm -f .npmrc

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npm run codegen

# Build the application
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

# Copy Prisma generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Change ownership of the app directory to the nodejs user
RUN chown -R userjs:nodejs /app

USER userjs

EXPOSE 3000

ENV SERVER_PORT=3000

CMD ["npm", "start"]