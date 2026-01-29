<div align="center">

# Claudegram

**Your personal AI agent, running on your machine, controlled from Telegram.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Claude](https://img.shields.io/badge/Claude_Agent_SDK-Anthropic-cc785c?logo=anthropic&logoColor=white)](https://docs.anthropic.com/en/docs/claude-code)
[![Telegram](https://img.shields.io/badge/Telegram_Bot-Grammy-26a5e4?logo=telegram&logoColor=white)](https://grammy.dev/)
[![Security](https://img.shields.io/badge/Security-Hardened-success?logo=security&logoColor=white)](docs/deployment.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<br />

```
  Telegram  ──▶  Grammy Bot  ──▶  Claude Agent SDK  ──▶  Your Machine
  voice/text     command router     agentic runtime       bash, files, code
```

</div>

---

## What is this?

Claudegram bridges Telegram to a **full Claude Code agent** running locally on your machine. Send a message in Telegram — Claude reads your files, runs commands, writes code, browses Reddit, fetches Medium articles, transcribes voice notes, and speaks responses back. All from your phone.

This is not a simple API wrapper. It's the real Claude Code agent with tool access — Bash, file I/O, code editing, web browsing — packaged behind a Telegram interface with streaming responses, session memory, and rich output formatting.

**Production-ready security:** Container isolation, input validation, SSRF prevention, comprehensive test coverage, and CI/CD security scanning.

---

## Features

<table>
<tr>
<td width="50%" valign="top">

### Agent Core
- Full Claude Code with tool access (Bash, Read, Write, Edit, Glob, Grep)
- Session resume across messages — Claude remembers everything
- Project-based working directories
- Streaming responses with live-updating messages
- Model picker: Sonnet · Opus · Haiku
- Plan mode, explore mode, loop mode

### Reddit Integration
- `/reddit` — posts, subreddits, user profiles
- `/vreddit` — download & send Reddit-hosted videos
- Auto-compression for videos > 50 MB (CRF → two-pass)
- Original oversized videos archived locally
- Large threads auto-export to JSON

### Medium Integration
- `/medium` — fetch paywalled articles via Freedium
- Telegraph Instant View, save as Markdown, or both
- Pure TypeScript, no Python/Playwright needed

</td>
<td width="50%" valign="top">

### Voice & Audio
- Send a voice note → transcribed via Groq Whisper → fed to Claude
- `/transcribe` — standalone transcription (reply-to or prompt)
- `/tts` — agent responses spoken back as Telegram voice notes
- 13 voices via OpenAI TTS (`gpt-4o-mini-tts`)

### Rich Output
- MarkdownV2 formatting with automatic escaping
- Telegraph Instant View for long responses & tables
- Smart chunking that preserves code blocks
- ForceReply interactive prompts for multi-step commands
- Inline keyboards for settings (model, mode, TTS, clear)

### Image Uploads
- Send photos or image docs in chat
- Saved to project under `.claudegram/uploads/`
- Claude is notified with path + caption

</td>
</tr>
<tr>
<td colspan="2">

### Security & Testing
- **Container isolation** — Docker/Podman with rootless execution, seccomp, read-only filesystem
- **Input validation** — Zod schemas, URL validation, SSRF prevention, path sanitization
- **Feature flags** — Disable Reddit/Medium/TTS/Extract via environment variables
- **Comprehensive test suite** — Unit and integration tests for all security-critical paths
- **CI security pipeline** — ESLint security plugin, Trivy scanning, automated testing
- **Graceful degradation** — External service failures don't crash the bot

</td>
</tr>
</table>

---

## Quick Start

### Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js 18+** | with npm (for local development) |
| **Docker or Podman** | for containerized deployment (recommended) |
| **Claude Code CLI** | installed and authenticated — `claude` in your PATH |
| **Telegram bot token** | from [@BotFather](https://t.me/botfather) |
| **Your Telegram user ID** | from [@userinfobot](https://t.me/userinfobot) |

### Setup

```bash
git clone https://github.com/lliWcWill/claudegram.git
cd claudegram
cp .env.example .env
```

Edit `.env`:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
ALLOWED_USER_IDS=your_user_id
```

### Run

**Option 1: Docker (Recommended)**

```bash
docker compose up -d
```

See [docs/deployment.md](docs/deployment.md) for production deployment with rootless Docker/Podman.

**Option 2: Local Development**

```bash
npm install
npm run dev        # dev mode with hot reload
```

Open your bot in Telegram → `/start`

---

## Deployment

### Docker Compose (Production)

The recommended deployment method uses Docker Compose with comprehensive security hardening:

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

**Security features enabled:**
- Rootless user execution (UID 1000)
- Read-only root filesystem
- Seccomp profile
- Resource limits (CPU/memory)
- Network isolation
- User namespace remapping (Podman)

### Rootless Podman

For maximum security, use rootless Podman with user namespace remapping:

```bash
# Configure user namespace remapping
echo "claudegram:100000:65536" | sudo tee -a /etc/subuid
echo "claudegram:100000:65536" | sudo tee -a /etc/subgid

# Deploy
podman-compose up -d
```

See **[docs/deployment.md](docs/deployment.md)** for complete production deployment guide, including:
- Rootless Docker/Podman configuration
- Volume mounting strategies
- Systemd service setup
- Security hardening checklist
- Troubleshooting

---

## Commands

### Session
| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/project` | Set working directory (interactive picker) |
| `/newproject <name>` | Create and switch to a new project |
| `/clear` | Clear conversation + session |
| `/status` | Current session info |
| `/sessions` | List saved sessions |
| `/resume` | Pick from recent sessions |
| `/continue` | Resume most recent session |

### Agent Modes
| Command | Description |
|---------|-------------|
| `/plan` | Plan mode for complex tasks |
| `/explore` | Explore codebase to answer questions |
| `/loop` | Run iteratively until task complete |
| `/model` | Switch Sonnet / Opus / Haiku |
| `/mode` | Toggle streaming / wait |

### Content
| Command | Description |
|---------|-------------|
| `/reddit` | Fetch Reddit posts, subreddits, profiles |
| `/vreddit` | Download Reddit-hosted videos |
| `/medium` | Fetch Medium articles via Freedium |
| `/file` | Download a project file |
| `/telegraph` | View Markdown as Instant View page |

### Voice & TTS
| Command | Description |
|---------|-------------|
| `/tts` | Toggle voice replies, pick voice |
| `/transcribe` | Transcribe audio to text |
| *Send voice note* | Auto-transcribed → processed by Claude |

### Utility
| Command | Description |
|---------|-------------|
| `/ping` | Health check |
| `/context` | Show Claude context / token usage |
| `/botstatus` | Bot process status |
| `/restartbot` | Restart the bot |
| `/cancel` | Cancel current request |
| `/commands` | Show all commands |

---

## Optional Integrations

<details>
<summary><strong>Reddit — <code>/reddit</code> & <code>/vreddit</code></strong></summary>

`/reddit` requires [redditfetch.py](https://github.com/lliWcWill/redditfetch) for text content. `/vreddit` works out of the box (uses Reddit's DASH manifests + ffmpeg).

```bash
# .env
REDDITFETCH_PATH=/absolute/path/to/redditfetch.py
```

Video downloads need `ffmpeg` and `ffprobe` on your PATH (standard on most Linux/macOS systems). Videos over 50 MB are automatically compressed before sending to Telegram.

</details>

<details>
<summary><strong>Medium — <code>/medium</code></strong></summary>

Pure TypeScript via Freedium mirror — no extra dependencies.

```bash
# .env (optional tuning)
FREEDIUM_HOST=freedium-mirror.cfd
MEDIUM_TIMEOUT_MS=15000
```

</details>

<details>
<summary><strong>Voice Transcription — Groq Whisper</strong></summary>

```bash
# .env
GROQ_API_KEY=your_groq_key
GROQ_TRANSCRIBE_PATH=/absolute/path/to/groq_transcribe.py
```

</details>

<details>
<summary><strong>Text-to-Speech — OpenAI TTS</strong></summary>

```bash
# .env
OPENAI_API_KEY=your_openai_key
TTS_MODEL=gpt-4o-mini-tts
TTS_VOICE=coral
TTS_RESPONSE_FORMAT=opus
```

13 voices available: `alloy`, `ash`, `ballad`, `cedar`, `coral`, `echo`, `fable`, `marin`, `nova`, `onyx`, `sage`, `shimmer`, `verse`

</details>

---

## Configuration Reference

All config lives in `.env`. See [`.env.example`](.env.example) for the full annotated reference.

### Required

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `ALLOWED_USER_IDS` | Comma-separated Telegram user IDs |

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | API key (optional with Claude Max subscription) |
| `WORKSPACE_DIR` | `$HOME` | Root directory for project picker |
| `CLAUDE_EXECUTABLE_PATH` | `claude` | Path to Claude Code CLI |
| `BOT_NAME` | `Claudegram` | Bot name in system prompt |
| `STREAMING_MODE` | `streaming` | `streaming` or `wait` |
| `DANGEROUS_MODE` | `false` | Auto-approve all tool permissions |

### Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `FEATURE_REDDIT` | `true` | Enable `/reddit` and `/vreddit` commands |
| `FEATURE_MEDIUM` | `true` | Enable `/medium` command |
| `FEATURE_TTS` | `true` | Enable text-to-speech features |
| `FEATURE_EXTRACT` | `true` | Enable `/extract` command for media |

### Reddit

| Variable | Default | Description |
|----------|---------|-------------|
| `REDDITFETCH_PATH` | — | Path to `redditfetch.py` |
| `REDDIT_VIDEO_MAX_SIZE_MB` | `50` | Max video size before compression |
| `REDDITFETCH_TIMEOUT_MS` | `30000` | Execution timeout |
| `REDDITFETCH_JSON_THRESHOLD_CHARS` | `8000` | Auto-switch to JSON output |

### Medium / Freedium

| Variable | Default | Description |
|----------|---------|-------------|
| `FREEDIUM_HOST` | `freedium-mirror.cfd` | Freedium mirror host |
| `MEDIUM_TIMEOUT_MS` | `15000` | Fetch timeout |
| `MEDIUM_FILE_THRESHOLD_CHARS` | `8000` | File save threshold |

### Voice & TTS

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | — | Groq API key for Whisper |
| `GROQ_TRANSCRIBE_PATH` | — | Path to `groq_transcribe.py` |
| `OPENAI_API_KEY` | — | OpenAI API key for TTS |
| `TTS_VOICE` | `coral` | Default TTS voice |
| `TTS_MODEL` | `gpt-4o-mini-tts` | TTS model |

---

## Architecture

```
src/
├── bot/
│   ├── bot.ts                     # Bot setup, handler registration
│   ├── handlers/
│   │   ├── command.handler.ts     # All slash commands + inline keyboards
│   │   ├── message.handler.ts     # Text routing, ForceReply dispatch
│   │   ├── voice.handler.ts       # Voice download, transcription, agent relay
│   │   └── photo.handler.ts       # Image save + agent notification
│   └── middleware/
│       ├── auth.ts                # User whitelist
│       └── stale-filter.ts        # Ignore stale messages on restart
├── claude/
│   ├── agent.ts                   # Claude Agent SDK, session resume, system prompt
│   ├── session-manager.ts         # Per-chat session state
│   ├── request-queue.ts           # Sequential request queue
│   └── command-parser.ts          # Help text + command descriptions
├── reddit/
│   └── vreddit.ts                 # Reddit video download + compression pipeline
├── medium/
│   └── freedium.ts                # Freedium article fetcher
├── telegram/
│   ├── message-sender.ts          # Streaming, chunking, Telegraph routing
│   ├── markdown.ts                # MarkdownV2 escaping
│   ├── telegraph.ts               # Telegraph Instant View client
│   └── deduplication.ts           # Message dedup
├── tts/
│   ├── tts.ts                     # TTS provider routing (Groq / OpenAI)
│   ├── tts-settings.ts            # Per-chat voice settings
│   └── voice-reply.ts             # TTS hook for agent responses
├── audio/
│   └── transcribe.ts              # Shared transcription utilities
├── validation/
│   ├── schemas.ts                 # Zod schemas for input validation
│   ├── url.ts                     # URL safety validation, SSRF prevention
│   ├── path.ts                    # Path sanitization, traversal protection
│   └── env.ts                     # Environment variable filtering
├── features/
│   ├── flags.ts                   # Feature flag system
│   └── errors.ts                  # Service error handling
├── config.ts                      # Zod-validated environment config
└── index.ts                       # Entry point
```

---

## Development

```bash
npm run dev          # Dev mode with hot reload (tsx watch)
npm run typecheck    # Type check only
npm run build        # Compile to dist/
npm start            # Run compiled build
npm test             # Run test suite
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run lint         # Check code with ESLint
npm run lint:fix     # Auto-fix linting issues
```

### Bot Control Script

```bash
./scripts/claudegram-botctl.sh dev start      # Start dev mode
./scripts/claudegram-botctl.sh dev restart     # Restart dev
./scripts/claudegram-botctl.sh prod start      # Start production
./scripts/claudegram-botctl.sh dev log         # Tail logs
./scripts/claudegram-botctl.sh dev status      # Check if running
```

### Self-Editing Workflow

If Claudegram is editing its own codebase, use **prod mode** to avoid hot-reload restarts:

```bash
./scripts/claudegram-botctl.sh prod start      # No hot reload
# ... let Claude edit files ...
./scripts/claudegram-botctl.sh prod restart     # Apply changes
```

Then `/continue` or `/resume` in Telegram to restore your session.

---

## Testing

Comprehensive test suite covering security-critical code paths:

### Test Organization

```
tests/
├── unit/                           # Unit tests for validation modules
│   ├── security/                   # Input validation, sanitization
│   └── features/                   # Feature flags, error handling
├── integration/                    # Integration tests for external services
│   ├── audio/                      # Transcription workflows
│   ├── media/                      # Media extraction
│   ├── medium/                     # Freedium integration
│   └── reddit/                     # Reddit video downloads
├── helpers/                        # Test utilities and mocks
└── mocks/                          # Mock implementations
```

### Running Tests

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode for development
npm run test:coverage       # Generate coverage report
```

### Test Coverage

- **Security validation** — URL validation, path sanitization, SSRF prevention
- **Input handling** — Zod schemas, error sanitization, env filtering
- **Feature flags** — Graceful degradation, service toggles
- **File operations** — Magic byte validation, file type detection
- **External integrations** — Reddit, Medium, transcription services

All security-critical functions have dedicated test suites with both positive and negative test cases.

---

## Security

Claudegram follows defense-in-depth principles with multiple layers of protection:

### Container Isolation
- **Rootless execution** — runs as non-root user inside container
- **User namespace remapping** — prevents privilege escalation
- **Seccomp profile** — restricts system calls to essential operations
- **Read-only filesystem** — only workspace and temp dirs are writable
- **Resource limits** — CPU, memory, and PID constraints
- **Network isolation** — blocks access to private IP ranges

See [docs/deployment.md](docs/deployment.md) for production hardening guide.

### Input Validation
- **Zod schemas** — strict typing for all external inputs
- **URL validation** — protocol whitelist (http/https only)
- **SSRF prevention** — blocks private IPs, localhost, metadata endpoints
- **Path sanitization** — prevents directory traversal attacks
- **File type validation** — magic byte checking for uploads
- **ReDoS protection** — safe regex patterns throughout

### Application Security
- **User whitelist** — only approved Telegram IDs can interact
- **Environment filtering** — child processes get sanitized env vars
- **Error sanitization** — stack traces and paths scrubbed from output
- **Feature flags** — disable risky integrations (Reddit/Medium/Extract)
- **Graceful degradation** — external service failures don't crash the bot
- **Permission mode** — uses `acceptEdits` by default
- **Dangerous mode** — opt-in auto-approve for all tool permissions

### CI/CD Security
- **ESLint security plugin** — static analysis for vulnerabilities
- **Trivy scanning** — dependency and container image audits
- **Automated testing** — comprehensive unit and integration tests
- **Type checking** — strict TypeScript compilation
- **Dependency overrides** — patches for known vulnerabilities

### Secrets Management
- **Environment variables** — all secrets loaded from `.env` (gitignored)
- **Stdin credential passing** — no secrets in process arguments
- **No logging of sensitive data** — credentials filtered before output

---

## Credits

Original project by [NachoSEO](https://github.com/NachoSEO/claudegram). Extended with Reddit video downloads, voice transcription, TTS, Medium integration, Telegraph output, image uploads, and session continuity.

## License

MIT
