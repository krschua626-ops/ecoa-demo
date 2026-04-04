# eCOA Localization Workflow — Prototype Demo

AI-powered eCOA localization workflow demonstrating a five-agent system for instrument string migration.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add your Anthropic API key
```bash
cp .env.local.example .env.local
# Edit .env.local and replace 'your_api_key_here' with your real key
```

### 3. Build and start
```bash
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** Run `npm run build` after any code changes before restarting the server.

## Demo flow

| Step | Screen | Agent | Type |
|------|--------|-------|------|
| 1 | Study Intake | Orchestration Agent | Simulated |
| 2 | Migration Guidelines | Guidelines Agent | Simulated |
| 3 | Translation Agent | Translation Agent | **Live AI** |
| 4 | Intake Validation | Intake Agent | Simulated |
| 5 | Screenshot Review | Review Classification Agent | **Live AI** |

## Live AI calls

- **Screen 3 — Translation Agent**: click Run Translation → returns per-string translations with confidence scores
- **Screen 5 — Screenshot Review**: click any flag card → classifies issue type, authority scope, and recommended disposition

## Sample data

Pre-loaded in `data/`:
- `sample-english.json` — PHQ-9 English eCOA JSON (18 strings)
- `sample-german.txt` — validated German paper translation
- `guidelines.json` — 8 PHQ-9 migration rules
- `intake.json` — study intake gap analysis
- `intake-validation.json` — pre-seeded validation results
- `flags.json` — 4 linguist flags for screenshot review

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/translate` | POST | Translation Agent — calls claude-sonnet-4-20250514 |
| `/api/classify-flag` | POST | Review Classification Agent — calls claude-sonnet-4-20250514 |
| `/api/health` | GET | Health check |

## Environment

```
ANTHROPIC_API_KEY=sk-ant-...
```
