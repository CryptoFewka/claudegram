# Multi-stage Dockerfile for Claudegram
# Stage 1: Builder - Compile TypeScript
# Stage 2: Production - Minimal runtime with rootless execution

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM node:24-slim AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Copy source code and TypeScript configuration
COPY src/ ./src/
COPY tsconfig.json ./

# Compile TypeScript to JavaScript
RUN npm run build

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM node:24-slim

# Install runtime dependencies in a single layer to minimize image size
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Media processing
    ffmpeg \
    # Secure file downloads
    curl \
    # Python for yt-dlp
    python3 \
    python3-pip \
    # Process monitoring for debugging
    procps \
    # Required for gh CLI installation
    gpg \
    # Passwordless sudo for Claude Code package management
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp from PyPI (latest version, not outdated apt package)
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# Install GitHub CLI using official apt repository
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy production artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Create non-root user and group for ownership (user namespace mapping handles UID on host)
RUN groupadd --gid 1001 claudegram \
    && useradd --uid 1001 --gid 1001 --create-home --shell /bin/bash claudegram

# Create writable directories and set ownership
RUN mkdir -p /app/workspace /home/claudegram \
    && chown -R claudegram:claudegram /app /home/claudegram

# Configure passwordless sudo for Claude Code package management
# Container runs as root (UID 0) inside, but user namespace remapping
# maps this to unprivileged UID on host (see docker-compose.yml userns_mode)
RUN echo "root ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/root \
    && chmod 0440 /etc/sudoers.d/root

# Runtime user: root inside container (UID 0)
# Host sees: unprivileged UID via user namespace remapping
# This allows Claude Code to install packages inside container
# while preventing host root escalation even with kernel exploits

# Set environment defaults
ENV NODE_ENV=production

# Health check to verify Node.js runtime is functional
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Auto-start bot when container runs
ENTRYPOINT ["node", "dist/index.js"]
