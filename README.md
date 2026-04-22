# eCOA Localization Workflow — Prototype Demo

A five-step AI-powered pipeline for migrating eCOA instrument strings from a paper translation into a structured JSON format.

## What it does

Given an English eCOA JSON (with English placeholder strings in the target-language fields) and a translated paper document (PDF or TXT), the system locates each string in the document and copies it verbatim into the correct JSON slot — no machine translation involved.

## Workflow

| Step | Screen | Description |
|------|--------|-------------|
| 1 | Study Intake | Instrument details and language gap analysis |
| 2 | Migration Guidelines | Instrument-specific localization rules |
| 3 | AI Migration | Verbatim string migration from paper document |
| 4 | Intake Validation | Structural and semantic validation checks |
| 5 | Screenshot Review | AI classification of linguist-raised flags |

Steps 1, 2, and 4 use pre-loaded demo data. Steps 3 and 5 make live Anthropic API calls.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add your Anthropic API key
```bash
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env.local
```

### 3. Build and start
```bash
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** Run `npm run build` after any code changes, then restart the server.

## Using the AI Migration (Step 3)

Upload your own files or use the pre-loaded IBDQ demo data:

| Input | Format | Description |
|-------|--------|-------------|
| Non-migrated JSON | `.json` | Platform export with English `source_locale_text` and empty `target_locale_text` fields |
| Translated document | `.pdf` or `.txt` | Paper translation — the source of truth for target-language strings |

Supported scripts: **Arabic** (anchor-based verbatim extraction), **Korean**, **Chinese/Japanese** (direct migration with XML preservation).

Click **Run Migration** to start. Results show per-string confidence (Matched / Review / No match) with expandable rationale. Download the migrated JSON when done.

## Sample data

Pre-loaded IBDQ v1.0 demo data in `data/`:

| File | Contents |
|------|----------|
| `sample-english.json` | IBDQ English eCOA JSON (265 strings) |
| `sample-arabic.txt` | Extracted Arabic paper translation |
| `guidelines.json` | IBDQ migration rules |
| `intake.json` | Language gap analysis |
| `intake-validation.json` | Pre-seeded validation results |
| `flags.json` | Linguist flag cards for screenshot review |

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `POST /api/translate` | String migration — positional alignment + Claude claude-sonnet-4-20250514 |
| `POST /api/extract-pdf` | PDF text extraction (pdfjs-dist) |
| `POST /api/classify-flag` | Linguist flag classification — Claude claude-sonnet-4-20250514 |
| `GET /api/health` | Health check |

## Tech stack

- **Next.js 15** (App Router, production mode)
- **Anthropic claude-sonnet-4-20250514** for AI migration and flag classification
- **Tailwind CSS** for styling
- **pdfjs-dist** for PDF text extraction
