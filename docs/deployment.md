# Claudegram Deployment Guide

## Security Architecture

### How User Namespace Remapping Works

Claudegram uses **user namespace remapping** to provide Claude Code with root privileges inside the container while maintaining host security isolation.

**Inside container:**
- Claude Code runs as root (UID 0)
- Can install packages via `apt-get`, `npm`, `pip`
- Has passwordless `sudo` access
- Full control over container filesystem

**On host:**
- Container process runs as unprivileged UID (e.g., 100000)
- Cannot access host root filesystem
- Cannot escalate to host root even with kernel exploits
- Container root UID 0 → Host UID 100000+ (mapped by kernel)

**Example:**
```bash
# Inside container
$ id
uid=0(root) gid=0(root) groups=0(root)

# On host
$ ps aux | grep node
100000   12345  ... node dist/index.js
```

This approach allows Claude Code to adapt the container environment (install dependencies, configure tools) while preventing host escape attacks.

## Deployment Options

### Option 1: Rootless Docker (Recommended)

Rootless Docker runs the entire Docker daemon as a non-root user, providing the strongest security isolation.

**Setup:**
```bash
# Install rootless Docker
dockerd-rootless-setuptool.sh install

# Switch to rootless context
docker context use rootless

# Verify rootless mode
docker info | grep rootless
# Output: rootless: true
```

**Deploy:**
```bash
docker compose up -d
```

**Advantages:**
- Docker daemon runs as non-root user
- No configuration needed in docker-compose.yml
- Strongest security isolation (daemon + container both rootless)

**Considerations:**
- Requires Docker 20.10+ with rootless support
- Cannot bind to privileged ports (< 1024)
- Limited access to host network features

### Option 2: Standard Docker with daemon.json

Standard Docker daemon runs as root, but user namespace remapping isolates container processes.

**Setup:**
```bash
# Configure Docker daemon for user namespace remapping
sudo tee /etc/docker/daemon.json <<EOF
{
  "userns-remap": "default"
}
EOF

# Restart Docker daemon
sudo systemctl restart docker

# Verify configuration
docker info | grep "userns"
# Output: Security Options: ... userns
```

**Deploy:**
```bash
docker compose up -d
```

**Advantages:**
- Works with existing Docker installations
- Supports privileged port binding (if needed)
- Full host network access

**Considerations:**
- Requires Docker daemon restart
- Affects ALL containers on the host
- Volumes created before remapping may have permission issues

### Option 3: Podman (Built-in Rootless)

Podman is rootless by default and requires no additional configuration.

**Setup:**
```bash
# Install Podman (Debian/Ubuntu)
sudo apt-get install -y podman

# No daemon configuration needed (rootless by default)
```

**Deploy:**
```bash
podman-compose up -d
# Or with Docker-compatible CLI:
podman compose up -d
```

**Advantages:**
- Rootless by default (no configuration)
- No daemon (simpler architecture)
- Docker-compatible CLI

**Considerations:**
- Slightly different behavior from Docker in edge cases
- May need `podman-compose` package separately

## Runtime Configuration

### Required Environment Variables

Create `.env` file in project root:

```bash
# Telegram bot token (required)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Anthropic API key for Claude Code integration (required)
ANTHROPIC_API_KEY=your_api_key_here

# Feature toggles (optional - all default to true)
FEATURE_REDDIT=true
FEATURE_MEDIUM=true
FEATURE_TTS=true
FEATURE_EXTRACT=true

# Optional: Custom workspace directory (inside container)
# WORKSPACE_DIR=/app/workspace
```

**Security:**
- NEVER commit `.env` to version control (already in `.gitignore`)
- Use secret management in production (Docker secrets, Kubernetes secrets, etc.)

### Volume Configuration

The bot uses a named volume for Claude Code workspace isolation:

```bash
# Volume is created automatically on first run
docker compose up -d

# View volume details
docker volume inspect claudegram-workspace

# Backup workspace (if needed)
docker run --rm -v claudegram-workspace:/data -v $(pwd):/backup alpine tar czf /backup/workspace-backup.tar.gz -C /data .

# Restore workspace (if needed)
docker run --rm -v claudegram-workspace:/data -v $(pwd):/backup alpine tar xzf /backup/workspace-backup.tar.gz -C /data
```

## Security Verification

### Verify User Namespace Remapping

```bash
# Start container
docker compose up -d

# Check UID inside container (should be 0 = root)
docker compose exec claudegram id
# Expected: uid=0(root) gid=0(root) groups=0(root)

# Check UID on host (should be 100000+ or unprivileged)
ps aux | grep "node dist/index.js" | grep -v grep
# Expected: 100000 or similar unprivileged UID

# Verify Claude Code can install packages inside container
docker compose exec claudegram apt-get update
docker compose exec claudegram apt-get install -y vim
# Should succeed without errors
```

### Verify Defense-in-Depth Layers

```bash
# Layer 1: Read-only root filesystem
docker compose exec claudegram touch /test-write
# Expected: Read-only file system error

# Layer 2: Writable tmpfs mounts
docker compose exec claudegram touch /tmp/test-write
# Should succeed (tmpfs is writable)

# Layer 3: No capabilities
docker compose exec claudegram cat /proc/1/status | grep CapEff
# Expected: CapEff: 0000000000000000 (no capabilities)

# Layer 4: Seccomp profile active
docker compose exec claudegram grep Seccomp /proc/1/status
# Expected: Seccomp: 2 (filtering mode)

# Layer 5: Resource limits
docker compose exec claudegram cat /sys/fs/cgroup/memory/memory.limit_in_bytes
# Expected: 2147483648 (2GB in bytes)
```

## Defense-in-Depth Layers

Claudegram employs multiple independent security layers. Even if one layer is bypassed, others remain effective:

1. **User Namespace Remapping (CONT-02)**
   - Container root → Host unprivileged UID
   - Prevents host root escalation
   - Stops kernel exploit privilege escalation

2. **Read-only Root Filesystem (CONT-03)**
   - Application code immutable at runtime
   - Prevents backdoor installation
   - Attacker cannot modify binaries

3. **Capability Dropping (CONT-04)**
   - ALL Linux capabilities removed
   - No privileged operations allowed
   - Cannot bind privileged ports, access raw sockets, etc.

4. **Seccomp Profile (CONT-04)**
   - Deny-by-default syscall filtering
   - Blocks dangerous syscalls (mount, ptrace, bpf, etc.)
   - Prevents kernel exploit techniques

5. **Resource Limits (CONT-05)**
   - Memory: 2GB cap
   - CPU: 2 cores
   - Processes: 256/512 (soft/hard)
   - Prevents resource exhaustion attacks

6. **Workspace Isolation (CONT-06)**
   - Claude Code workspace separate from app code
   - Named volume (not host bind mount)
   - Cannot access host filesystem

## Troubleshooting

### Container Cannot Install Packages

**Symptom:**
```
E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)
```

**Cause:** User namespace remapping not active, container running as non-root.

**Solution:**
- **Rootless Docker:** Ensure `docker context use rootless` is active
- **Standard Docker:** Verify `/etc/docker/daemon.json` has `"userns-remap": "default"` and daemon restarted
- **Podman:** Should work by default, check `podman info | grep rootless`

### Volume Permission Errors

**Symptom:**
```
Error: EACCES: permission denied, mkdir '/app/workspace/...'
```

**Cause:** Volume created before user namespace remapping was enabled.

**Solution:**
```bash
# Stop container
docker compose down

# Remove old volume
docker volume rm claudegram-workspace

# Recreate with correct permissions
docker compose up -d
```

### Seccomp Profile Not Found

**Symptom:**
```
Error response from daemon: cannot load seccomp profile: open container/seccomp.json: no such file or directory
```

**Cause:** Seccomp profile file missing or incorrect path.

**Solution:**
```bash
# Verify file exists
ls -la container/seccomp.json

# If missing, file should be in project root under container/
# Check docker-compose.yml security_opt references correct path
```

### Health Check Failing

**Symptom:**
```
claudegram is unhealthy
```

**Cause:** Node.js runtime not responding or container misconfigured.

**Solution:**
```bash
# Check container logs
docker compose logs claudegram

# Verify Node.js works inside container
docker compose exec claudegram node -e "console.log('Node.js OK')"

# Check process status
docker compose exec claudegram ps aux
```

## Health Monitoring

### Container Health Status

```bash
# Check health status
docker compose ps

# View health check logs
docker inspect claudegram | grep -A 10 Health

# Continuous monitoring
watch -n 5 'docker compose ps'
```

### Application Logs

```bash
# View recent logs
docker compose logs -f claudegram

# View last 100 lines
docker compose logs --tail=100 claudegram

# Logs are rotated automatically (10MB max, 3 files)
```

### Resource Usage

```bash
# Real-time stats
docker stats claudegram

# Memory usage
docker compose exec claudegram cat /sys/fs/cgroup/memory/memory.usage_in_bytes

# CPU usage
docker compose exec claudegram cat /sys/fs/cgroup/cpu/cpuacct.usage
```

## Updates

### Update Application Code

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d

# Verify new version
docker compose logs -f claudegram
```

### Update Dependencies

The container uses pinned versions from `package-lock.json`. To update:

```bash
# Update package-lock.json on host
npm update

# Rebuild container with new dependencies
docker compose build --no-cache
docker compose up -d
```

### Update Base Image

When `node:24-slim` base image is updated:

```bash
# Pull latest base image
docker pull node:24-slim

# Rebuild container
docker compose build --no-cache
docker compose up -d
```

## Production Considerations

### Secret Management

For production deployments, avoid `.env` files. Use:

- **Docker Swarm:** `docker secret create`
- **Kubernetes:** `kubectl create secret`
- **AWS ECS:** Parameter Store / Secrets Manager
- **Azure Container Instances:** Key Vault
- **Google Cloud Run:** Secret Manager

### Monitoring and Alerting

Integrate with monitoring systems:

```yaml
# Example: Prometheus metrics endpoint (if added to bot)
labels:
  prometheus.io/scrape: "true"
  prometheus.io/port: "9090"
  prometheus.io/path: "/metrics"
```

### High Availability

For production deployments:

- Run multiple replicas behind a load balancer
- Use persistent volumes for workspace data
- Implement graceful shutdown handling
- Configure restart policies (`restart: unless-stopped`)

### Backup Strategy

Critical data to backup:

1. **Workspace volume** (Claude Code files): See "Volume Configuration" above
2. **Environment variables** (`.env` file): Store in secret manager
3. **Application configuration**: Version controlled in git

Recommended backup frequency:
- Workspace: Daily incremental, weekly full
- Configuration: On every change (git commit)
