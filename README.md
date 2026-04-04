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

## Demo scenario

**Study:** IBD-2024-017 — Phase III QoL study in Inflammatory Bowel Disease  
**Sponsor:** Meridian Clinical Research  
**Instrument:** IBDQ v1.0 (Inflammatory Bowel Disease Questionnaire, 32 items, © McMaster University)  
**Active language:** Arabic (Israel) — no prior eCOA on file; paper translation provided by Mapi (v1.0, March 2017)

## Demo flow

| Step | Screen | Agent | Mode |
|------|--------|-------|------|
| 1 | Study Intake | Orchestration Agent | Simulated |
| 2 | Migration Guidelines | Guidelines Agent | Simulated |
| 3 | String Migration | Migration Agent | **Live AI** |
| 4 | Intake Validation | Intake Agent | Simulated |
| 5 | Screenshot Review | Review Classification Agent | **Live AI** |

### Step-by-step walkthrough

**Step 1 — Study Intake** (`/intake`)  
The Orchestration Agent surfaces a gap analysis across five target languages. Arabic (Israel) is flagged *Migration Required* — no prior eCOA version exists, only a Mapi-validated paper translation. English (US) and French (France) are cleared for reuse; Chinese (Simplified) is pending license approval. Click **Proceed to Migration Guidelines**.

**Step 2 — Migration Guidelines** (`/guidelines`)  
The Guidelines Agent displays 8 instrument-specific migration rules captured during the English eCOA build: RTL text direction, one item per screen, 7-point Likert vertical radio buttons, verbatim numeric prefix preservation, domain scoring, item-stem length limits, embedded timeframe instructions, and IBDQ-Stoma variant exclusions. Click **Proceed to Translation Agent**.

**Step 3 — String Migration** (`/translation`) — *Live AI*  
Click **Run Migration** to invoke Claude. The agent does **not generate new translations** — it locates each English JSON key's verbatim equivalent in the Arabic paper translation document and copies it across.

Migration runs in two phases:
1. **Positional alignment** (no LLM): numbered question stems and response options are matched directly to the PDF index — fast and deterministic.
2. **LLM for unmatched strings** (Claude): sends batches of up to 30 remaining strings. For Arabic, Claude returns a short anchor (diacritic-free) used to locate the verbatim text in the source document; this preserves author-approved diacritics exactly. XML tags and numeric prefixes from the English source are restored onto the migrated Arabic text.

Results show per-string confidence — **Matched** / **Review** / **No match** / **Human review** — with expandable rationale and flag notes. High- and medium-confidence strings are auto-populated; low-confidence strings retain the English placeholder.

- Both inputs can be swapped: upload a different English JSON (flat or platform array format) or a new translated document (`.txt` or `.pdf`)
- After migration, click **Download Migrated JSON** to export the populated file

**Step 4 — Intake Validation** (`/validation`)  
Pre-seeded results from the Intake Agent across three collapsible sections:
- **Structural Checks** — 6 checks, all passed (key count parity, no blank strings, UTF-8 encoding, JSON schema, no trailing whitespace)
- **Semantic Flags** — 2 flags for meaning-preservation issues (clinical register choices in Q3 and Q7)
- **Instrument-Context Flags** — 2 flags for migration guideline violations (Q1 stem length, Q1 RTL numeric prefix alignment)

Expand any flag card to see the English source, translated string, issue description, and recommended action.

**Step 5 — Screenshot Review** (`/review`) — *Live AI*  
Four linguist flags from a human screenshot review are queued for disposition. Click any flag card to invoke Claude automatically. The Review Classification Agent classifies each flag and returns:
- **Issue type**: Mechanical, Rendering, or Linguistic
- **Authority scope**: Within linguist scope / Requires team sign-off / Conflicts with author-approved
- **Evidence** referencing the applicable migration guidelines
- **Recommended disposition**: Approve, Reject, or Escalate

Click **Approve** / **Reject** / **Escalate** to resolve the flag — the queue auto-advances to the next pending item. The left panel shows tabbed English (author-approved) and Arabic (flagged) reference screens for each item. Use **Reset demo** to clear all dispositions.

## Live AI calls

- **Screen 3 — String Migration**: click **Run Migration** → verbatim string extraction with per-key confidence scores and rationale (hybrid positional + LLM, batches of 30)
- **Screen 5 — Screenshot Review**: click any flag card → issue type, authority scope, guideline evidence, and recommended disposition

## Sample data

Pre-loaded in `data/`:

| File | Contents |
|------|----------|
| `sample-english.json` | IBDQ v1.0 English eCOA — UUID keys mapped to English strings with XML tags and numeric prefixes |
| `sample-arabic.txt` | IBDQ v1.0 Arabic (Israel) paper translation — Mapi-validated, v1.0, March 2017 |
| `guidelines.json` | 8 IBDQ migration rules (RTL, response scale, scoring, safety, edge cases) |
| `intake.json` | Study intake gap analysis — IBD-2024-017, 5 target languages |
| `intake-validation.json` | Pre-seeded validation results: 6 structural checks, 2 semantic flags, 2 instrument-context flags |
| `flags.json` | 4 linguist flags for screenshot review (punctuation, register, RTL rendering) |
| `resolutions.json` | Persisted flag disposition results |

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/translate` | POST | Migration Agent — positional alignment + Claude for unmatched strings; batches of 30; calls `claude-sonnet-4-20250514` |
| `/api/classify-flag` | POST | Review Classification Agent — classifies by issue type, authority scope, and disposition; calls `claude-sonnet-4-20250514` |
| `/api/extract-pdf` | POST | Extracts Arabic text from uploaded PDFs using `pdfjs-dist`; handles RTL reading order, diacritic reattachment, and tatweel removal |
| `/api/health` | GET | Health check |

## Environment

```
ANTHROPIC_API_KEY=sk-ant-...
```
